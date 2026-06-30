#!/usr/bin/env python3
import os
import asyncio
from dotenv import load_dotenv
from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from telegram.constants import ChatAction, ParseMode
import google.generativeai as genai

load_dotenv()

BOT_TOKEN = os.getenv("GEMINI_BOT_TOKEN", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
SYSTEM_PROMPT = os.getenv("GEMINI_SYSTEM_PROMPT", "Ты умный и полезный ИИ-ассистент.")

genai.configure(api_key=GEMINI_API_KEY)

# user_id -> list of Content objects (conversation history)
sessions: dict[int, list] = {}


def get_model():
    return genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=SYSTEM_PROMPT,
    )


def split_text(text: str, limit: int = 4000) -> list[str]:
    """Split long text into Telegram-safe chunks."""
    if len(text) <= limit:
        return [text]
    parts = []
    while len(text) > limit:
        split_at = text.rfind("\n", 0, limit)
        if split_at == -1:
            split_at = limit
        parts.append(text[:split_at])
        text = text[split_at:].lstrip("\n")
    if text:
        parts.append(text)
    return parts


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    sessions[uid] = []
    name = update.effective_user.first_name or "друг"
    await update.message.reply_text(
        f"Привет, {name}! Я Gemini AI 🤖\n\n"
        f"Пиши мне что угодно — отвечу.\n"
        f"/reset — сбросить историю диалога\n"
        f"/model — текущая модель\n"
        f"/help — помощь"
    )


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    sessions[uid] = []
    await update.message.reply_text("История диалога сброшена ✅")


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Команды:\n"
        "/start — начать заново\n"
        "/reset — сбросить историю\n"
        "/model — показать модель\n"
        "/help — это сообщение"
    )


async def cmd_model(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f"Текущая модель: {MODEL_NAME}")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    user_text = update.message.text

    if uid not in sessions:
        sessions[uid] = []

    await context.bot.send_chat_action(
        chat_id=update.effective_chat.id, action=ChatAction.TYPING
    )

    try:
        model = get_model()
        chat = model.start_chat(history=sessions[uid])
        response = await asyncio.to_thread(chat.send_message, user_text)
        sessions[uid] = chat.history
        reply = response.text
    except Exception as e:
        reply = f"Ошибка Gemini: {e}"

    for chunk in split_text(reply):
        await update.message.reply_text(chunk)


async def post_init(app: Application):
    await app.bot.set_my_commands([
        BotCommand("start", "Начать / приветствие"),
        BotCommand("reset", "Сбросить историю диалога"),
        BotCommand("model", "Текущая модель Gemini"),
        BotCommand("help", "Помощь"),
    ])


def main():
    if not BOT_TOKEN:
        raise RuntimeError("GEMINI_BOT_TOKEN не задан в .env")
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY не задан в .env")

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("reset", cmd_reset))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("model", cmd_model))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print(f"Bot started | model: {MODEL_NAME}")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
