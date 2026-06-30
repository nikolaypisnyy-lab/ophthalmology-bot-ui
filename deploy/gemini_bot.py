#!/usr/bin/env python3
import os
import io
import re
import asyncio
from dotenv import load_dotenv
from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from telegram.constants import ChatAction
from telegram.request import HTTPXRequest
from google import genai
from google.genai import types

load_dotenv()

BOT_TOKEN = os.getenv("GEMINI_BOT_TOKEN", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
SYSTEM_PROMPT = os.getenv(
    "GEMINI_SYSTEM_PROMPT",
    "Ты умный и полезный ИИ-ассистент. "
    "Когда тебя просят создать файл или написать код — оборачивай содержимое файла в блок ```язык ... ```. "
    "Например: ```python\n...\n``` или ```html\n...\n```. Это позволит автоматически отправить файл пользователю."
)

client = genai.Client(api_key=GEMINI_API_KEY)

sessions: dict[int, list] = {}

EXT_MAP = {
    "python": "py", "py": "py",
    "javascript": "js", "js": "js", "typescript": "ts", "ts": "ts",
    "html": "html", "css": "css",
    "json": "json", "yaml": "yaml", "yml": "yml",
    "bash": "sh", "shell": "sh", "sh": "sh",
    "sql": "sql", "markdown": "md", "md": "md",
    "rust": "rs", "go": "go", "java": "java", "cpp": "cpp", "c": "c",
    "xml": "xml", "csv": "csv", "toml": "toml", "ini": "ini",
    "dockerfile": "Dockerfile",
}


def extract_code_blocks(text: str) -> list[tuple[str, str]]:
    """Return list of (lang, code) from ```lang\\n...\\n``` blocks."""
    pattern = r"```(\w*)\n(.*?)```"
    return [(m.group(1).lower(), m.group(2)) for m in re.finditer(pattern, text, re.DOTALL)]


def split_text(text: str, limit: int = 4000) -> list[str]:
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


def make_config():
    return types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT)


async def send_reply(update: Update, reply: str):
    """Send text + any code blocks as file attachments."""
    for chunk in split_text(reply):
        await update.message.reply_text(chunk)

    for i, (lang, code) in enumerate(extract_code_blocks(reply), 1):
        ext = EXT_MAP.get(lang, "txt")
        filename = f"file_{i}.{ext}" if ext != "Dockerfile" else "Dockerfile"
        buf = io.BytesIO(code.encode("utf-8"))
        buf.name = filename
        await update.message.reply_document(document=buf, filename=filename)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    sessions[uid] = []
    name = update.effective_user.first_name or "друг"
    await update.message.reply_text(
        f"Привет, {name}! Я Gemini AI 🤖\n\n"
        f"Пиши, отправляй голосовые или проси создать файлы.\n"
        f"/reset — сбросить историю\n"
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
        "/model — текущая модель\n"
        "/help — это сообщение\n\n"
        "Поддерживаю:\n"
        "• Текстовые сообщения\n"
        "• Голосовые сообщения 🎤\n"
        "• Генерацию файлов (попроси написать код или файл)"
    )


async def cmd_model(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f"Текущая модель: {MODEL_NAME}")


def _send_text(history: list, user_text: str):
    chat = client.chats.create(model=MODEL_NAME, history=history, config=make_config())
    response = chat.send_message(user_text)
    return response.text, list(chat.history)


def _send_audio(audio_bytes: bytes):
    audio_part = types.Part.from_bytes(data=audio_bytes, mime_type="audio/ogg")
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[audio_part, "Это голосовое сообщение. Распознай речь и ответь на неё."],
        config=make_config(),
    )
    return response.text


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if uid not in sessions:
        sessions[uid] = []

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)

    try:
        reply, sessions[uid] = await asyncio.to_thread(_send_text, sessions[uid], update.message.text)
    except Exception as e:
        reply = f"Ошибка Gemini: {e}"

    await send_reply(update, reply)


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if uid not in sessions:
        sessions[uid] = []

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)

    try:
        tg_file = await context.bot.get_file(update.message.voice.file_id)
        audio_bytes = bytes(await tg_file.download_as_bytearray())
        reply = await asyncio.to_thread(_send_audio, audio_bytes)

        sessions[uid].append(types.Content(role="user", parts=[types.Part(text="[голосовое]")]))
        sessions[uid].append(types.Content(role="model", parts=[types.Part(text=reply)]))
    except Exception as e:
        reply = f"Ошибка обработки голосового: {e}"

    await send_reply(update, reply)


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

    request = HTTPXRequest(connect_timeout=30, read_timeout=60)
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .request(request)
        .post_init(post_init)
        .build()
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("reset", cmd_reset))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("model", cmd_model))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    print(f"Bot started | model: {MODEL_NAME}")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
