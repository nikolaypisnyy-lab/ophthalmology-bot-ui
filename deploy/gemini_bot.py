#!/usr/bin/env python3
import os
import io
import re
import shutil
import asyncio
import subprocess
from dotenv import load_dotenv
from telegram import Update, BotCommand, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
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
    "Когда тебя просят создать файл, код или документ — всегда оборачивай содержимое в блок с языком. "
    "Примеры: ```python\n...\n```, ```html\n...\n```, ```markdown\n...\n```. "
    "Когда просят PDF или документ — создавай содержимое в блоке ```markdown\n...\n```, бот сам сконвертирует в PDF. "
    "Никогда не говори что не можешь создать файл — всегда выдавай содержимое в блоке кода."
)

# RefMaster settings
REFMASTER_BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"
REFMASTER_API_PATH = "/root/medeye/api/api.py"
REFMASTER_SERVICE = "refmaster-bot"
REFMASTER_API_SERVICE = "refmaster-app"

# Lucy Clinic settings
LUCY_BOT_PATH = "/opt/lucybot/bot.py"
LUCY_SERVICE = "lucy_bot"

client = genai.Client(api_key=GEMINI_API_KEY)

sessions: dict[int, list] = {}
pending_edits: dict[int, dict] = {}  # uid -> {path, new_code, service}

AVAILABLE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-3.0-pro",
    "gemini-3.0-flash",
]

IMAGE_MODEL = "imagen-3.0-generate-002"
IMAGE_KEYWORDS = re.compile(
    r"(нарисуй|нарисуй мне|создай (картинку|изображение|фото|рисунок)|"
    r"сгенерируй (картинку|изображение|фото)|покажи как выглядит|"
    r"draw|generate image|create image|make image|imagine)",
    re.IGNORECASE
)

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

PDF_LANGS = {"markdown", "md", "text", "txt", ""}

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
]


def _find_font() -> str | None:
    return next((p for p in FONT_PATHS if os.path.exists(p)), None)


def _markdown_to_pdf(content: str, filename: str) -> io.BytesIO | None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        font = _find_font()
        font_name = "DejaVu"
        if font:
            pdfmetrics.registerFont(TTFont(font_name, font))
        else:
            font_name = "Helvetica"

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=2*cm, rightMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)

        normal = ParagraphStyle("normal", fontName=font_name, fontSize=11, leading=16, spaceAfter=4)
        h1 = ParagraphStyle("h1", fontName=font_name, fontSize=16, leading=20, spaceBefore=10, spaceAfter=6)
        h2 = ParagraphStyle("h2", fontName=font_name, fontSize=13, leading=18, spaceBefore=8, spaceAfter=4)

        story = []
        for line in content.splitlines():
            stripped = line.strip()
            if not stripped:
                story.append(Spacer(1, 6))
            elif stripped.startswith("## "):
                story.append(Paragraph(stripped[3:].strip(), h2))
            elif stripped.startswith("# "):
                story.append(Paragraph(stripped[2:].strip(), h1))
            else:
                text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', stripped)
                text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
                text = re.sub(r'^[-*•]\s+', '• ', text)
                story.append(Paragraph(text, normal))

        doc.build(story)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"PDF error: {e}")
        return None


def extract_code_blocks(text: str) -> list[tuple[str, str]]:
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


async def send_reply(update: Update, reply: str, want_pdf: bool = False):
    for chunk in split_text(reply):
        await update.message.reply_text(chunk)

    blocks = extract_code_blocks(reply)

    for i, (lang, code) in enumerate(blocks, 1):
        ext = EXT_MAP.get(lang, "txt")
        filename = f"file_{i}.{ext}" if ext != "Dockerfile" else "Dockerfile"
        buf = io.BytesIO(code.encode("utf-8"))
        await update.message.reply_document(document=buf, filename=filename)

    if want_pdf:
        pdf_content = blocks[0][1] if blocks else reply
        pdf_buf = await asyncio.to_thread(_markdown_to_pdf, pdf_content, "document")
        if pdf_buf:
            await update.message.reply_document(document=pdf_buf, filename="document.pdf")
    elif blocks:
        for i, (lang, code) in enumerate(blocks, 1):
            if lang in PDF_LANGS:
                pdf_buf = await asyncio.to_thread(_markdown_to_pdf, code, f"file_{i}")
                if pdf_buf:
                    await update.message.reply_document(document=pdf_buf, filename=f"file_{i}.pdf")


# ── RefMaster управление ──────────────────────────────────────────────────────

def _service_status(name: str) -> str:
    r = subprocess.run(["systemctl", "is-active", name], capture_output=True, text=True)
    return r.stdout.strip()


def _service_logs(name: str, lines: int = 30) -> str:
    r = subprocess.run(
        ["journalctl", "-u", name, f"-n{lines}", "--no-pager", "-l"],
        capture_output=True, text=True
    )
    return r.stdout.strip() or "(нет логов)"


def _read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def _ask_gemini_edit(current_code: str, task: str, file_hint: str) -> str:
    prompt = (
        f"Ты редактируешь Python-файл Telegram бота: {file_hint}\n\n"
        f"Текущий код:\n```python\n{current_code}\n```\n\n"
        f"Задача: {task}\n\n"
        f"Верни ТОЛЬКО полный исправленный Python-код в блоке ```python```. "
        f"Никаких пояснений до или после блока."
    )
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt],
        config=types.GenerateContentConfig(system_instruction="Ты senior Python разработчик."),
    )
    return response.text


async def cmd_rx(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = " ".join(context.args or []).strip()

    # /rx без аргументов — показать статус
    if not args:
        bot_status = _service_status(REFMASTER_SERVICE)
        api_status = _service_status(REFMASTER_API_SERVICE)
        await update.message.reply_text(
            f"RefMaster статус:\n"
            f"• Bot ({REFMASTER_SERVICE}): {bot_status}\n"
            f"• API ({REFMASTER_API_SERVICE}): {api_status}\n\n"
            f"Команды:\n"
            f"/rx логи — последние логи бота\n"
            f"/rx апи логи — логи API\n"
            f"/rx правки: <задача> — изменить bot_slim_v2.6.py\n"
            f"/rx апи правки: <задача> — изменить api.py\n"
            f"/rx перезапуск — перезапустить бот\n"
        )
        return

    low = args.lower()

    # Логи
    if low in ("логи", "logs", "log"):
        logs = await asyncio.to_thread(_service_logs, REFMASTER_SERVICE)
        for chunk in split_text(logs):
            await update.message.reply_text(f"```\n{chunk}\n```", parse_mode="Markdown")
        return

    if low in ("апи логи", "api logs", "api log"):
        logs = await asyncio.to_thread(_service_logs, REFMASTER_API_SERVICE)
        for chunk in split_text(logs):
            await update.message.reply_text(f"```\n{chunk}\n```", parse_mode="Markdown")
        return

    # Перезапуск
    if low in ("перезапуск", "restart"):
        subprocess.run(["systemctl", "restart", REFMASTER_SERVICE])
        await update.message.reply_text("RefMaster бот перезапущен ✅")
        return

    # Редактирование бота
    if low.startswith("правки:"):
        task = args[7:].strip()
        await _edit_file(update, task, REFMASTER_BOT_PATH, REFMASTER_SERVICE, "bot_slim_v2.6.py")
        return

    # Редактирование API
    if low.startswith("апи правки:"):
        task = args[11:].strip()
        await _edit_file(update, task, REFMASTER_API_PATH, REFMASTER_API_SERVICE, "api.py")
        return

    await update.message.reply_text("Неизвестная команда. Напиши /rx для справки.")


async def _edit_file(update: Update, task: str, path: str, service: str, hint: str):
    uid = update.effective_user.id
    await update.message.reply_text(f"Читаю {hint} и отправляю в Gemini...")
    await update.message.reply_chat_action(ChatAction.TYPING)

    try:
        current_code = await asyncio.to_thread(_read_file, path)
        reply = await asyncio.to_thread(_ask_gemini_edit, current_code, task, hint)
        blocks = extract_code_blocks(reply)

        if not blocks:
            await update.message.reply_text(f"Gemini не вернул код:\n\n{reply[:1000]}")
            return

        new_code = blocks[0][1]
        pending_edits[uid] = {"path": path, "new_code": new_code, "service": service}

        # Показываем diff (первые/последние строки нового кода)
        preview = new_code[:800] + ("\n..." if len(new_code) > 800 else "")
        await update.message.reply_text(
            f"Gemini предлагает изменения в {hint}.\n\nПревью:\n```python\n{preview}\n```",
            parse_mode="Markdown"
        )

        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Применить", callback_data="rx_apply"),
            InlineKeyboardButton("❌ Отмена", callback_data="rx_cancel"),
        ]])
        await update.message.reply_text(
            "Применить изменения и перезапустить сервис?",
            reply_markup=keyboard
        )

    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")


async def cmd_lucy(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = " ".join(context.args or []).strip()

    if not args:
        status = _service_status(LUCY_SERVICE)
        await update.message.reply_text(
            f"LucyClinic Bot статус: {status}\n\n"
            f"Команды:\n"
            f"/lucy логи — последние логи\n"
            f"/lucy правки: <задача> — изменить bot.py\n"
            f"/lucy перезапуск — перезапустить бота"
        )
        return

    low = args.lower()

    if low in ("логи", "logs", "log"):
        logs = await asyncio.to_thread(_service_logs, LUCY_SERVICE)
        for chunk in split_text(logs):
            await update.message.reply_text(f"```\n{chunk}\n```", parse_mode="Markdown")
        return

    if low in ("перезапуск", "restart"):
        subprocess.run(["systemctl", "restart", LUCY_SERVICE])
        await update.message.reply_text("LucyClinic бот перезапущен ✅")
        return

    if low.startswith("правки:"):
        task = args[7:].strip()
        await _edit_file(update, task, LUCY_BOT_PATH, LUCY_SERVICE, "bot.py (LucyClinic)")
        return

    await update.message.reply_text("Неизвестная команда. Напиши /lucy для справки.")


async def callback_model(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global MODEL_NAME
    query = update.callback_query
    await query.answer()
    MODEL_NAME = query.data[len("model_"):]
    await query.edit_message_text(f"Модель переключена на: {MODEL_NAME}")


async def callback_rx(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    uid = query.from_user.id
    await query.answer()

    if query.data == "rx_cancel":
        pending_edits.pop(uid, None)
        await query.edit_message_text("Отменено.")
        return

    if query.data == "rx_apply":
        edit = pending_edits.pop(uid, None)
        if not edit:
            await query.edit_message_text("Нет ожидающих изменений.")
            return

        path = edit["path"]
        new_code = edit["new_code"]
        service = edit["service"]
        backup = path + ".bak"

        try:
            shutil.copy2(path, backup)
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_code)
            result = subprocess.run(["systemctl", "restart", service], capture_output=True, text=True)

            if result.returncode == 0:
                await query.edit_message_text(f"✅ Изменения применены, {service} перезапущен.\nБэкап: {backup}")
            else:
                shutil.copy2(backup, path)
                subprocess.run(["systemctl", "restart", service])
                await query.edit_message_text(f"❌ Сервис не запустился. Восстановлен бэкап.\n{result.stderr[:500]}")
        except Exception as e:
            await query.edit_message_text(f"❌ Ошибка: {e}")


# ── Стандартные обработчики ───────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    sessions[uid] = []
    name = update.effective_user.first_name or "друг"
    await update.message.reply_text(
        f"Привет, {name}! Я Gemini AI 🤖\n\n"
        f"Пиши, отправляй голосовые или проси создать файлы.\n"
        f"/rx — управление RefMaster ботом\n"
        f"/reset — сбросить историю\n"
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
        "RefMaster:\n"
        "/rx — статус сервисов\n"
        "/rx логи — логи бота\n"
        "/rx правки: <задача> — изменить код бота\n"
        "/rx апи правки: <задача> — изменить api.py\n"
        "/rx перезапуск — перезапустить бота\n\n"
        "Изображения:\n"
        "/img <промпт> — сгенерировать картинку\n"
        "или просто: «нарисуй закат над морем»"
    )


async def cmd_model(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global MODEL_NAME
    args = " ".join(context.args or []).strip()

    if args:
        MODEL_NAME = args
        await update.message.reply_text(f"Модель переключена на: {MODEL_NAME}")
        return

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            f"{'✅ ' if m == MODEL_NAME else ''}{m}",
            callback_data=f"model_{m}"
        )]
        for m in AVAILABLE_MODELS
    ])
    await update.message.reply_text(
        f"Текущая модель: {MODEL_NAME}\n\nВыбери или напиши /model <название>:",
        reply_markup=keyboard
    )


def _generate_image(prompt: str) -> bytes:
    # Try Imagen 3 first
    try:
        response = client.models.generate_images(
            model=IMAGE_MODEL,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
            ),
        )
        return response.generated_images[0].image.image_bytes
    except Exception as e:
        print(f"Imagen failed ({e}), trying gemini-2.0-flash-exp...")

    # Fallback: gemini-2.0-flash-exp with image output
    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
        ),
    )
    for part in response.candidates[0].content.parts:
        if hasattr(part, "inline_data") and part.inline_data:
            return part.inline_data.data
    raise RuntimeError("Ни Imagen, ни Gemini не вернули изображение")


async def send_image(update: Update, prompt: str):
    await update.message.reply_chat_action(ChatAction.UPLOAD_PHOTO)
    try:
        image_bytes = await asyncio.to_thread(_generate_image, prompt)
        buf = io.BytesIO(image_bytes)
        buf.name = "image.png"
        await update.message.reply_photo(photo=buf, caption=f"🎨 {prompt[:200]}")
    except Exception as e:
        await update.message.reply_text(f"Ошибка генерации изображения: {e}")


async def cmd_img(update: Update, context: ContextTypes.DEFAULT_TYPE):
    prompt = " ".join(context.args or []).strip()
    if not prompt:
        await update.message.reply_text("Укажи что нарисовать: /img закат над горами")
        return
    await send_image(update, prompt)


def _send_text(history: list, user_text: str):
    chat = client.chats.create(model=MODEL_NAME, history=history, config=make_config())
    response = chat.send_message(user_text)
    return response.text, list(chat.history)


def _transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe only — return the spoken text without answering."""
    audio_part = types.Part.from_bytes(data=audio_bytes, mime_type="audio/ogg")
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[audio_part, "Транскрибируй это голосовое сообщение. Верни ТОЛЬКО текст речи, без ответа на него."],
    )
    return response.text.strip()


def _send_audio(audio_bytes: bytes) -> str:
    """Transcribe and answer."""
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

    user_text = update.message.text
    want_pdf = bool(re.search(r'\bpdf\b', user_text, re.IGNORECASE))

    # Detect image generation request
    if IMAGE_KEYWORDS.search(user_text):
        # Ask Gemini to extract/translate the prompt to English for better results
        prompt_reply, _ = await asyncio.to_thread(
            _send_text, [],
            f"Переведи этот запрос на изображение на английский язык для нейросети, "
            f"верни ТОЛЬКО промпт без пояснений: {user_text}"
        )
        await send_image(update, prompt_reply.strip())
        return

    try:
        reply, sessions[uid] = await asyncio.to_thread(_send_text, sessions[uid], user_text)
    except Exception as e:
        reply = f"Ошибка Gemini: {e}"

    await send_reply(update, reply, want_pdf=want_pdf)


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if uid not in sessions:
        sessions[uid] = []

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)

    try:
        tg_file = await context.bot.get_file(update.message.voice.file_id)
        audio_bytes = bytes(await tg_file.download_as_bytearray())

        # Transcribe first
        transcribed = await asyncio.to_thread(_transcribe_audio, audio_bytes)

        # Route to image generation if needed
        if IMAGE_KEYWORDS.search(transcribed):
            await update.message.reply_text(f"🎤 «{transcribed}»")
            prompt_en, _ = await asyncio.to_thread(_send_text, [],
                f"Переведи этот запрос на изображение на английский язык для нейросети, "
                f"верни ТОЛЬКО промпт без пояснений: {transcribed}")
            await send_image(update, prompt_en.strip())
            return

        # Normal voice reply
        reply = await asyncio.to_thread(_send_audio, audio_bytes)
        sessions[uid].append(types.Content(role="user", parts=[types.Part(text=f"[голосовое: {transcribed}]")]))
        sessions[uid].append(types.Content(role="model", parts=[types.Part(text=reply)]))
    except Exception as e:
        reply = f"Ошибка обработки голосового: {e}"
        await update.message.reply_text(reply)
        return

    await send_reply(update, reply)


async def post_init(app: Application):
    await app.bot.set_my_commands([
        BotCommand("start", "Начать / приветствие"),
        BotCommand("reset", "Сбросить историю диалога"),
        BotCommand("img", "Сгенерировать изображение"),
        BotCommand("rx", "Управление RefMaster"),
        BotCommand("lucy", "Управление LucyClinic Bot"),
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
    app.add_handler(CommandHandler("img", cmd_img))
    app.add_handler(CommandHandler("rx", cmd_rx))
    app.add_handler(CommandHandler("lucy", cmd_lucy))
    app.add_handler(CallbackQueryHandler(callback_model, pattern="^model_"))
    app.add_handler(CallbackQueryHandler(callback_rx, pattern="^rx_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    print(f"Bot started | model: {MODEL_NAME}")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
