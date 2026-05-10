#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import datetime
import fcntl
import html
import threading
import secrets
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except Exception:
    pass

import telebot
from telebot import types
from master_db import master_db

# ================= SETTINGS =================
TOKEN = str(os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_TOKEN") or "").strip()
if not TOKEN: raise RuntimeError("BOT_TOKEN is missing")

bot = telebot.TeleBot(TOKEN, parse_mode="HTML", use_class_middlewares=True)

# WebApp URLs
WEBAPP_URL = str(os.getenv("WEBAPP_URL") or "https://medeye.92.38.48.231.nip.io/").strip()

# Admin IDs (указан ваш ID для первичного контроля)
ADMIN_IDS = {379286602}

# Single instance guard
LOCK_FILE_PATH = "/tmp/medeye_bot.lock"
_LOCK_FH = None

def acquire_lock():
    global _LOCK_FH
    _LOCK_FH = open(LOCK_FILE_PATH, 'w')
    try:
        fcntl.flock(_LOCK_FH.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise RuntimeError('Другой экземпляр бота уже запущен')

# ================= CONTEXT =================
# Используем глобальный словарь вместо threading.local для сохранения контекста между запросами
USER_CONTEXT: Dict[int, Dict[str, Any]] = {}

def get_ctx(uid: int) -> Dict[str, Any]:
    if uid not in USER_CONTEXT:
        # Загружаем первую доступную клинику из базы
        u = master_db.get_user_clinic(uid)
        if u:
            USER_CONTEXT[uid] = {"cid": u["clinic_id"], "role": u["role"], "name": u["clinic_name"]}
        else:
            USER_CONTEXT[uid] = {"cid": None, "role": None, "name": None}
    return USER_CONTEXT[uid]

def load_clinic(uid: int, force_cid: str = None):
    if force_cid:
        u = master_db.get_user_clinic(uid, force_cid)
        if u:
            USER_CONTEXT[uid] = {"cid": u["clinic_id"], "role": u["role"], "name": u["clinic_name"]}
            return
    
    # Если контекста еще нет, инициализируем
    get_ctx(uid)

class ClinicMiddleware(telebot.handler_backends.BaseMiddleware):
    def __init__(self): self.update_types = ['message', 'callback_query']
    def pre_process(self, message, data):
        uid = getattr(message.from_user, 'id', None)
        if uid: load_clinic(uid)
    def post_process(self, message, data, exception): pass

bot.setup_middleware(ClinicMiddleware())

def html_escape(s: Any) -> str:
    return html.escape(str(s if s is not None else ""), quote=False)

# ================= MARKUPS =================
def main_menu_markup(uid: int):
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True, is_persistent=True, input_field_placeholder="Выберите действие...")
    
    # Формируем URL с ID текущей клиники
    context = get_ctx(uid)
    cid = context["cid"]
    
    url = WEBAPP_URL
    if cid:
        url = f"{WEBAPP_URL}?clinic={cid}" if "?" not in WEBAPP_URL else f"{WEBAPP_URL}&clinic={cid}"
        
    kb.row(types.KeyboardButton("🚀 Открыть RefMaster", web_app=types.WebAppInfo(url)))
    
    clinics = master_db.get_user_clinics(uid)
    if len(clinics) > 1:
        kb.row("🏥 Сменить клинику")
    
    if cid:
        u = master_db.get_user_clinic(uid, cid)
        if u and (u["role"] == "admin" or uid in ADMIN_IDS):
            kb.row("👥 Управление доступом")
            kb.row("⚙️ Управление клиниками", "🛡️ Бэкап прав")
            kb.row("📦 Бэкап базы")
            kb.row("🔗 Пригласить дистрибьютора")
    
    kb.row("ℹ️ Инфо")
    return kb

# ================= HANDLERS =================
@bot.message_handler(commands=['start', 'menu'])
def start_cmd(message):
    uid = message.from_user.id

    # Проверяем инвайт-токен дистрибьютора: /start dist_XXXXXXXX
    parts = message.text.split(None, 1)
    if len(parts) > 1 and parts[1].startswith("dist_"):
        token = parts[1].strip()
        if token in DIST_TOKENS:
            # Токен разовый — удаляем после использования
            DIST_TOKENS.pop(token, None)
            dist = master_db.get_distributor(uid)
            if dist:
                bot.send_message(uid, f"✅ Вы уже зарегистрированы. Используйте /distributor.")
                return
            DIST_REG[uid] = {"step": "name"}
            bot.send_message(uid,
                "📦 <b>Регистрация в IOL Marketplace RefMaster</b>\n\n"
                "Введите <b>название вашей компании</b>:"
            )
            return
        else:
            bot.send_message(uid, "❌ Ссылка недействительна или уже использована.")
            return

    ctx = get_ctx(uid)
    cid = ctx.get("cid")
    
    if not cid:
        # Проверяем — возможно это уже одобренный дистрибьютор
        dist = master_db.get_distributor(uid)
        if dist:
            bot.send_message(uid,
                f"👋 Добро пожаловать в <b>IOL Marketplace RefMaster</b>!\n\n"
                f"Компания: <b>{html.escape(dist['name'])}</b>\n\n"
                "Используйте /distributor для управления складом.",
                reply_markup=types.ReplyKeyboardRemove()
            )
            return

        text = (
            "👋 Добро пожаловать в <b>RefMaster</b>.\n\n"
            "Вы ещё не авторизованы. Нажмите кнопку ниже, чтобы "
            "отправить запрос администратору клиники."
        )
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton("📝 Запросить доступ", callback_data=f"req_access:{uid}"))
        bot.send_message(uid, text, reply_markup=kb)
        return

    # Получаем актуальные данные именно по активной клинике из контекста
    u = master_db.get_user_clinic(uid, cid)
    if not u:
        # Фоллбэк: если текущий CID почему-то стал невалидным, пробуем найти любую другую
        u = master_db.get_user_clinic(uid)
        if u:
            load_clinic(uid, force_cid=u['clinic_id'])
            cid = u['clinic_id']
        else:
            bot.send_message(uid, "❌ Ошибка: доступ не найден.")
            return

    bot.send_message(uid, f"👋 Приветствуем, {u['name']}!\nКлиника: <b>{u['clinic_name']}</b>", 
                     reply_markup=main_menu_markup(uid))

# Хранит инфо о заявке для flow создания новой клиники
# {admin_id: {'uid': requester_uid, 'name': requester_name}}
_PENDING_REQUESTS: Dict[int, Dict] = {}

def _get_clinics():
    if hasattr(master_db, 'get_all_clinics'):
        c = master_db.get_all_clinics()
        if c: return c
    rows = master_db.execute("SELECT * FROM clinics").fetchall()
    return [dict(r) for r in rows]

def _build_clinic_keyboard(requester_uid: int) -> types.InlineKeyboardMarkup:
    """Клавиатура выбора клиники: одна кнопка на клинику + создать новую + отклонить."""
    clinics = _get_clinics()
    kb = types.InlineKeyboardMarkup(row_width=1)
    for cl in clinics:
        kb.add(types.InlineKeyboardButton(
            f"🏥 {cl['name']}",
            callback_data=f"adm_sel:{requester_uid}:{cl['clinic_id']}"
        ))
    kb.add(types.InlineKeyboardButton("➕ Создать новую клинику", callback_data=f"adm_newcl:{requester_uid}"))
    kb.add(types.InlineKeyboardButton("❌ Отклонить", callback_data=f"adm_deny:{requester_uid}"))
    return kb

@bot.callback_query_handler(func=lambda c: c.data.startswith("req_access:"))
def handle_access_request(c):
    requester_uid = c.from_user.id
    name = f"{c.from_user.first_name or ''} {c.from_user.last_name or ''}".strip() or f"User_{requester_uid}"
    username = c.from_user.username or "—"

    text = (
        f"📥 <b>Новая заявка на доступ</b>\n\n"
        f"👤 {html.escape(name)}\n"
        f"🆔 <code>{requester_uid}</code>  @{username}\n\n"
        f"Выберите клинику для назначения:"
    )
    kb = _build_clinic_keyboard(requester_uid)
    for admin_id in ADMIN_IDS:
        bot.send_message(admin_id, text, reply_markup=kb)
        _PENDING_REQUESTS[admin_id] = {'uid': requester_uid, 'name': name}

    bot.edit_message_text(
        "✅ Запрос отправлен администратору. Ожидайте уведомления.",
        c.message.chat.id, c.message.message_id
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_sel:"))
def handle_admin_select_clinic(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    parts = c.data.split(":")
    requester_uid = int(parts[1])
    clinic_id = parts[2]

    # Получаем название клиники
    clinic_name = clinic_id
    try:
        rows = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (clinic_id,)).fetchone()
        if rows: clinic_name = rows[0]
    except: pass

    requester_name = _PENDING_REQUESTS.get(c.from_user.id, {}).get('name', f"User_{requester_uid}")

    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.row(
        types.InlineKeyboardButton("🔬 Хирург",      callback_data=f"adm_grant:{requester_uid}:surgeon:{clinic_id}"),
        types.InlineKeyboardButton("🔍 Диагностика", callback_data=f"adm_grant:{requester_uid}:diagnostic:{clinic_id}")
    )
    kb.add(types.InlineKeyboardButton("← Назад", callback_data=f"adm_back:{requester_uid}"))

    bot.edit_message_text(
        f"📥 <b>{html.escape(requester_name)}</b> → 🏥 <b>{html.escape(clinic_name)}</b>\n\nВыберите роль:",
        c.message.chat.id, c.message.message_id, reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_back:"))
def handle_admin_back(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    requester_uid = int(c.data.split(":")[1])
    ctx = _PENDING_REQUESTS.get(c.from_user.id, {})
    name = ctx.get('name', f"User_{requester_uid}")
    username = "—"

    text = (
        f"📥 <b>Заявка на доступ</b>\n\n"
        f"👤 {html.escape(name)}\n"
        f"🆔 <code>{requester_uid}</code>\n\n"
        f"Выберите клинику для назначения:"
    )
    bot.edit_message_text(text, c.message.chat.id, c.message.message_id,
                          reply_markup=_build_clinic_keyboard(requester_uid))

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_deny:"))
def handle_admin_deny(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    requester_uid = int(c.data.split(":")[1])
    _PENDING_REQUESTS.pop(c.from_user.id, None)
    bot.edit_message_text("❌ Заявка отклонена.", c.message.chat.id, c.message.message_id)
    try:
        bot.send_message(requester_uid, "❌ Ваша заявка на доступ была отклонена администратором.")
    except: pass

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_newcl:"))
def handle_admin_new_clinic(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    requester_uid = int(c.data.split(":")[1])
    _PENDING_REQUESTS[c.from_user.id] = {
        **_PENDING_REQUESTS.get(c.from_user.id, {}),
        'uid': requester_uid,
        'orig_msg_id': c.message.message_id
    }
    bot.answer_callback_query(c.id)
    msg = bot.send_message(c.from_user.id, "✏️ Введите <b>название новой клиники</b>:")
    bot.register_next_step_handler(msg, handle_new_clinic_name)

def handle_new_clinic_name(message):
    admin_id = message.from_user.id
    if admin_id not in ADMIN_IDS: return
    clinic_name = (message.text or "").strip()
    if not clinic_name:
        m = bot.send_message(admin_id, "⚠️ Название не может быть пустым. Введите ещё раз:")
        bot.register_next_step_handler(m, handle_new_clinic_name)
        return

    ctx = _PENDING_REQUESTS.get(admin_id, {})
    requester_uid = ctx.get('uid')
    if not requester_uid:
        bot.send_message(admin_id, "⚠️ Сессия истекла. Попросите пользователя повторить запрос.")
        return

    import uuid
    new_cid = f"c_{uuid.uuid4().hex[:8]}"
    try:
        master_db.execute(
            "INSERT INTO clinics (clinic_id, name) VALUES (?, ?)", (new_cid, clinic_name)
        )
        master_db.conn.commit()
    except Exception as e:
        bot.send_message(admin_id, f"❌ Ошибка создания клиники: {e}")
        return

    requester_name = ctx.get('name', f"User_{requester_uid}")
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.row(
        types.InlineKeyboardButton("🔬 Хирург",      callback_data=f"adm_grant:{requester_uid}:surgeon:{new_cid}"),
        types.InlineKeyboardButton("🔍 Диагностика", callback_data=f"adm_grant:{requester_uid}:diagnostic:{new_cid}")
    )
    bot.send_message(
        admin_id,
        f"✅ Клиника <b>{html.escape(clinic_name)}</b> создана!\n\n"
        f"Назначить <b>{html.escape(requester_name)}</b> в эту клинику?\nВыберите роль:",
        reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_grant:"))
def handle_admin_grant(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    parts = c.data.split(":")
    if len(parts) != 4: return

    target_uid = int(parts[1])
    role = parts[2]
    cid = parts[3]

    name = f"Сотрудник {target_uid}"
    try:
        user_info = bot.get_chat(target_uid)
        name = f"{user_info.first_name or ''} {user_info.last_name or ''}".strip() or name
    except: pass

    # Получаем название клиники
    clinic_name = cid
    try:
        row = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (cid,)).fetchone()
        if row: clinic_name = row[0]
    except: pass

    master_db.add_user(target_uid, cid, role, name)
    _PENDING_REQUESTS.pop(c.from_user.id, None)

    role_label = "Хирург" if role == "surgeon" else "Диагностика"
    bot.edit_message_text(
        f"✅ Доступ выдан!\n\n👤 {html.escape(name)}\n🏥 {html.escape(clinic_name)}\n🎭 {role_label}",
        c.message.chat.id, c.message.message_id
    )
    bot.send_message(
        target_uid,
        f"🎉 Вам выдан доступ!\n\nКлиника: <b>{html.escape(clinic_name)}</b>\nРоль: <b>{role_label}</b>\n\nОткройте приложение:",
        reply_markup=main_menu_markup(target_uid)
    )

@bot.message_handler(commands=['superadmin'])
def admin_secret_menu(message):
    if message.from_user.id not in ADMIN_IDS: return
    kb = types.InlineKeyboardMarkup()
    kb.row(
        types.InlineKeyboardButton("🌋 ЯДЕРНЫЙ БЭКАП", callback_data="admin_nuclear_backup"),
    )
    kb.row(
        types.InlineKeyboardButton("🛡️ Бэкап прав", callback_data="admin_backup_access"),
        types.InlineKeyboardButton("♻️ Восстановить прав", callback_data="admin_restore_init")
    )
    kb.add(types.InlineKeyboardButton("📦 Полный бэкап системный", callback_data="admin_full_backup_run"))
    bot.send_message(message.chat.id, "🔓 <b>SUPER ADMIN PANEL</b>", reply_markup=kb)

@bot.callback_query_handler(func=lambda call: call.data == 'admin_restore_init')
def handle_restore_init(call):
    if call.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(call.id)
    msg = bot.send_message(call.message.chat.id, "📤 <b>РЕЖИМ ВОССТАНОВЛЕНИЯ ПРАВ</b>\n\nПожалуйста, отправьте файл <code>master.db</code> в этот чат.")
    bot.register_next_step_handler(msg, handle_restore_final)

def handle_restore_final(message):
    if message.from_user.id not in ADMIN_IDS: return
    if not message.document or message.document.file_name != "master.db":
        bot.send_message(message.chat.id, "❌ Ошибка! Нужно прислать файл с названием <code>master.db</code>")
        return
    
    bot.send_message(message.chat.id, "⏳ Обработка базы... (делаю бэкап текущей)")
    try:
        file_info = bot.get_file(message.document.file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        
        # Бэкапим текущую и заменяем
        target_path = "/root/medeye/data/master.db"
        if not os.path.exists(target_path):
             target_path = "master.db" #Fallback
             
        if os.path.exists(target_path):
            os.rename(target_path, target_path + ".pre_restore")
        
        with open(target_path, 'wb') as new_file:
            new_file.write(downloaded_file)
        
        bot.send_message(message.chat.id, "✅ <b>БАЗА ПРАВ ВОССТАНОВЛЕНА!</b>\nПользователи и клиники теперь соответствуют вашему файлу.\n\nРекомендую перезапустить бота для очистки кэша.")
        # Очищаем контекст всех пользователей, чтобы они подтянули новые данные
        USER_CONTEXT.clear()
    except Exception as e:
        bot.send_message(message.chat.id, f"❌ Ошибка восстановления: {str(e)}")

@bot.callback_query_handler(func=lambda call: call.data == 'admin_full_backup_run')
def handle_full_backup_run(call):
    if call.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(call.id, "⏳ Запуск системного бэкапа...")
    full_backup_cmd(call.message)

@bot.callback_query_handler(func=lambda call: call.data == 'admin_nuclear_backup')
def handle_nuclear_backup(call):
    if call.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(call.id, "🌋 Готовлю ядерный бэкап...")
    # Здесь логика формирования секретной ссылки на скачивание всех баз
    import uuid
    import subprocess
    now = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    secret_id = str(uuid.uuid4())[:8]
    public_filename = f'medeye_nuclear_{now}_{secret_id}.tar.gz'
    
    bot.edit_message_text(f"🚀 <b>Ядерный процесс запущен...</b>\nФайл: <code>{public_filename}</code>", call.message.chat.id, call.message.message_id)
    
    try:
        # Создаем архив всех .db файлов
        subprocess.run(f"tar -czf /root/medeye/api/static/{public_filename} /root/medeye/data/*.db", shell=True)
        url = f"{WEBAPP_URL}static/{public_filename}"
        bot.send_message(call.message.chat.id, f"🌋 <b>ЯДЕРНЫЙ БЭКАП ГОТОВ!</b>\n\nСрок жизни ссылки: 15 минут.\n\n🔗 <a href='{url}'>СКАЧАТЬ ВСЕ БАЗЫ</a>")
    except Exception as e:
        bot.send_message(call.message.chat.id, f"❌ Ошибка взрыва: {str(e)}")

@bot.callback_query_handler(func=lambda call: call.data == 'admin_backup_access')
def handle_backup_access(call):
    if call.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(call.id, "🔐 Формирую бэкап прав доступа...")
    
    # Пути к основной базе пользователей
    paths = ["master.db", "/root/medeye/data/master.db", "/root/medeye/api/master.db"]
    found = False
    for p in paths:
        if os.path.exists(p):
            with open(p, "rb") as f:
                bot.send_document(call.message.chat.id, f, caption="🛡️ Бэкап прав доступа (master.db)")
                found = True
                break
    if not found:
        bot.send_message(call.message.chat.id, "❌ Файл master.db не найден на сервере.")

def _cl_list_keyboard() -> types.InlineKeyboardMarkup:
    rows = master_db.execute("SELECT * FROM clinics").fetchall()
    clinics = [dict(r) for r in rows]
    kb = types.InlineKeyboardMarkup(row_width=1)
    for cl in clinics:
        kb.add(types.InlineKeyboardButton(
            f"🏥 {cl['name']}",
            callback_data=f"cl_pick:{cl['clinic_id']}"
        ))
    kb.add(types.InlineKeyboardButton("➕ Создать клинику", callback_data="cl_new"))
    return kb

@bot.message_handler(func=lambda m: m.text == "⚙️ Управление клиниками")
def admin_clinics(message):
    if message.from_user.id not in ADMIN_IDS: return
    bot.send_message(
        message.chat.id,
        "🏥 <b>Управление клиниками</b>\n\nВыберите клинику:",
        reply_markup=_cl_list_keyboard()
    )

# ── Клиника → действия ────────────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data.startswith("cl_pick:"))
def cl_pick(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    cid = c.data.split(":", 1)[1]
    clinic_name = cid
    try:
        row = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (cid,)).fetchone()
        if row: clinic_name = row[0]
    except: pass
    # Считаем сотрудников
    all_users = master_db.get_all_users() or []
    cnt = sum(1 for u in all_users if u.get("clinic_id") == cid)
    kb = types.InlineKeyboardMarkup(row_width=1)
    kb.add(types.InlineKeyboardButton("✏️ Переименовать",  callback_data=f"cl_ren:{cid}"))
    kb.add(types.InlineKeyboardButton("🗑 Удалить клинику", callback_data=f"cl_del:{cid}"))
    kb.add(types.InlineKeyboardButton("← Назад",            callback_data="cl_back"))
    bot.edit_message_text(
        f"🏥 <b>{html_escape(clinic_name)}</b>\n"
        f"🆔 <code>{cid}</code>  ·  👥 {cnt} сотр.",
        c.message.chat.id, c.message.message_id, reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data == "cl_back")
def cl_back(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    bot.edit_message_text(
        "🏥 <b>Управление клиниками</b>\n\nВыберите клинику:",
        c.message.chat.id, c.message.message_id,
        reply_markup=_cl_list_keyboard()
    )

# ── Переименовать ─────────────────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data.startswith("cl_ren:"))
def cl_rename_init(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    cid = c.data.split(":", 1)[1]
    bot.answer_callback_query(c.id)
    msg = bot.send_message(c.message.chat.id, f"✏️ Введите новое название для клиники <code>{cid}</code>:")
    bot.register_next_step_handler(msg, cl_rename_final, cid, c.message.message_id)

def cl_rename_final(message, cid, orig_msg_id):
    new_name = (message.text or "").strip()
    if not new_name:
        m = bot.send_message(message.chat.id, "⚠️ Пустое название. Введите ещё раз:")
        bot.register_next_step_handler(m, cl_rename_final, cid, orig_msg_id)
        return
    master_db.rename_clinic(cid, new_name)
    # Обновляем исходное сообщение со списком
    try:
        bot.edit_message_text(
            "🏥 <b>Управление клиниками</b>\n\nВыберите клинику:",
            message.chat.id, orig_msg_id,
            reply_markup=_cl_list_keyboard()
        )
    except: pass
    bot.send_message(message.chat.id, f"✅ Клиника переименована в <b>{html_escape(new_name)}</b>.")

# ── Удалить ───────────────────────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data.startswith("cl_del:"))
def cl_delete_confirm(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    cid = c.data.split(":", 1)[1]
    clinic_name = cid
    try:
        row = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (cid,)).fetchone()
        if row: clinic_name = row[0]
    except: pass
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.row(
        types.InlineKeyboardButton("✅ Да, удалить", callback_data=f"cl_del_ok:{cid}"),
        types.InlineKeyboardButton("← Отмена",       callback_data=f"cl_pick:{cid}")
    )
    bot.edit_message_text(
        f"⚠️ Удалить клинику <b>{html_escape(clinic_name)}</b>?\n\n"
        f"Все доступы врачей будут аннулированы.",
        c.message.chat.id, c.message.message_id, reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("cl_del_ok:"))
def cl_delete_execute(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    cid = c.data.split(":", 1)[1]
    clinic_name = cid
    try:
        row = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (cid,)).fetchone()
        if row: clinic_name = row[0]
    except: pass
    db_file = master_db.delete_clinic(cid)
    bot.edit_message_text(
        f"✅ Клиника <b>{html_escape(clinic_name)}</b> удалена.\n"
        f"Архив БД: <code>{db_file}</code>",
        c.message.chat.id, c.message.message_id,
        reply_markup=types.InlineKeyboardMarkup().add(
            types.InlineKeyboardButton("← К списку клиник", callback_data="cl_back_new")
        )
    )

@bot.callback_query_handler(func=lambda c: c.data == "cl_back_new")
def cl_back_new(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    bot.edit_message_text(
        "🏥 <b>Управление клиниками</b>\n\nВыберите клинику:",
        c.message.chat.id, c.message.message_id,
        reply_markup=_cl_list_keyboard()
    )

# ── Создать клинику ───────────────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data == "cl_new")
def cl_create_init(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    msg = bot.send_message(
        c.message.chat.id,
        "➕ Введите название новой клиники\n(или <code>ID Название</code> для ручного ID):"
    )
    bot.register_next_step_handler(msg, admin_create_final)

# Backward compat
@bot.callback_query_handler(func=lambda c: c.data == "admin_clinics_refresh")
def admin_clinics_refresh(c):
    cl_back(c)

@bot.callback_query_handler(func=lambda c: c.data == "admin:create_init")
def admin_create_init(c):
    cl_create_init(c)

def admin_create_final(message):
    uid = message.from_user.id
    raw = message.text.strip()
    if not raw: return
    
    parts = raw.split(None, 1)
    if len(parts) == 2:
        cid_input, name = parts
        cid = master_db.create_clinic(name, clinic_id=cid_input)
    else:
        name = parts[0]
        cid = master_db.create_clinic(name)
    
    # Автоматически добавляем создателя как админа этой клиники
    master_db.add_user(uid, cid, "admin", message.from_user.first_name or "Admin")
    master_db.set_active_clinic(uid, cid)
    load_clinic(uid, force_cid=cid)
        
    bot.send_message(message.chat.id, f"✅ Клиника <b>{name}</b> создана!\nID: <code>{cid}</code>\n\nВы автоматически назначены администратором этой клиники.", reply_markup=main_menu_markup(uid))

ROLES_RU = {"admin": "Админ", "surgeon": "Хирург", "diagnostic": "Диагност"}
ROLES_ICON = {"admin": "👑", "surgeon": "🔬", "diagnostic": "🔍"}

def _acc_clinics_keyboard() -> types.InlineKeyboardMarkup:
    clinics = _get_clinics()
    all_users = master_db.get_all_users() or []
    kb = types.InlineKeyboardMarkup(row_width=1)
    for cl in clinics:
        cnt = sum(1 for u in all_users if u.get("clinic_id") == cl["clinic_id"])
        kb.add(types.InlineKeyboardButton(
            f"🏥 {cl['name']}  · {cnt} чел.",
            callback_data=f"acc_cl:{cl['clinic_id']}"
        ))
    return kb

def _acc_main_keyboard() -> types.InlineKeyboardMarkup:
    kb = types.InlineKeyboardMarkup(row_width=1)
    # Клиники
    clinics = _get_clinics()
    all_users = master_db.get_all_users() or []
    for cl in clinics:
        cnt = sum(1 for u in all_users if u.get("clinic_id") == cl["clinic_id"])
        kb.add(types.InlineKeyboardButton(
            f"🏥 {cl['name']}  · {cnt} чел.",
            callback_data=f"acc_cl:{cl['clinic_id']}"
        ))
    # Дистрибьюторы
    dists = master_db.get_all_distributors()
    kb.add(types.InlineKeyboardButton(
        f"📦 Дистрибьюторы IOL  · {len(dists)} чел.",
        callback_data="acc_dists"
    ))
    return kb

@bot.message_handler(func=lambda m: m.text == "👥 Управление доступом")
def admin_users(message):
    if message.from_user.id not in ADMIN_IDS: return
    bot.send_message(
        message.chat.id,
        "🏥 <b>Управление доступом</b>\n\nВыберите раздел:",
        reply_markup=_acc_main_keyboard()
    )

# ── Клиника → список врачей ───────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_cl:"))
def acc_show_doctors(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    cid = c.data.split(":", 1)[1]
    clinic_name = cid
    try:
        row = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (cid,)).fetchone()
        if row: clinic_name = row[0]
    except: pass

    all_users = master_db.get_all_users() or []
    doctors = [u for u in all_users if u.get("clinic_id") == cid]

    kb = types.InlineKeyboardMarkup(row_width=1)
    for u in doctors:
        if u.get("telegram_id") == c.from_user.id: continue  # не себя
        icon = ROLES_ICON.get(u.get("role", ""), "👤")
        role_label = ROLES_RU.get(u.get("role", ""), u.get("role", ""))
        kb.add(types.InlineKeyboardButton(
            f"{icon} {u['name']}  · {role_label}",
            callback_data=f"acc_doc:{u['telegram_id']}:{cid}"
        ))
    kb.add(types.InlineKeyboardButton("← Назад", callback_data="acc_back"))

    text = f"🏥 <b>{html_escape(clinic_name)}</b>\n\n"
    text += f"Сотрудников: {len(doctors)}" if doctors else "Нет сотрудников."
    bot.edit_message_text(text, c.message.chat.id, c.message.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data == "acc_dists")
def acc_show_distributors(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    dists = master_db.get_all_distributors()
    kb = types.InlineKeyboardMarkup(row_width=1)
    for d in dists:
        stock = master_db.get_stock_by_distributor(d['telegram_id'])
        kb.add(types.InlineKeyboardButton(
            f"📦 {d['name']}  · {d.get('region') or '—'}  · {len(stock)} поз.",
            callback_data=f"acc_dist:{d['telegram_id']}"
        ))
    kb.add(types.InlineKeyboardButton("← Назад", callback_data="acc_back"))
    text = f"📦 <b>Дистрибьюторы IOL</b>\n\nВсего: {len(dists)}"
    if not dists:
        text += "\n\nНет зарегистрированных дистрибьюторов."
    bot.edit_message_text(text, c.message.chat.id, c.message.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_dist:"))
def acc_dist_detail(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    dist_id = int(c.data.split(":", 1)[1])
    d = master_db.get_distributor(dist_id)
    if not d:
        bot.edit_message_text("Дистрибьютор не найден.", c.message.chat.id, c.message.message_id)
        return
    stock = master_db.get_stock_by_distributor(dist_id)
    kb = types.InlineKeyboardMarkup(row_width=1)
    kb.add(
        types.InlineKeyboardButton("✉️ Написать в Telegram", url=f"tg://user?id={dist_id}"),
        types.InlineKeyboardButton("❌ Отозвать доступ", callback_data=f"acc_dist_rev:{dist_id}"),
        types.InlineKeyboardButton("← Назад к дистрибьюторам", callback_data="acc_dists"),
    )
    text = (
        f"📦 <b>{html.escape(d['name'])}</b>\n\n"
        f"Регион: {html.escape(d.get('region') or '—')}\n"
        f"Контакт: {html.escape(d.get('contact') or '—')}\n"
        f"Telegram ID: <code>{dist_id}</code>\n"
        f"Позиций на складе: {len(stock)}\n"
        f"Зарегистрирован: {(d.get('created_at') or '')[:10]}"
    )
    bot.edit_message_text(text, c.message.chat.id, c.message.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_dist_rev:"))
def acc_dist_revoke(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    dist_id = int(c.data.split(":", 1)[1])
    d = master_db.get_distributor(dist_id)
    if not d:
        bot.edit_message_text("Не найдено.", c.message.chat.id, c.message.message_id)
        return
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton("✅ Да, отозвать", callback_data=f"acc_dist_rev_ok:{dist_id}"),
        types.InlineKeyboardButton("❌ Отмена", callback_data=f"acc_dist:{dist_id}"),
    )
    bot.edit_message_text(
        f"⚠️ Отозвать доступ дистрибьютора <b>{html.escape(d['name'])}</b>?\n"
        f"Склад также будет очищен.",
        c.message.chat.id, c.message.message_id, reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_dist_rev_ok:"))
def acc_dist_revoke_confirm(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    dist_id = int(c.data.split(":", 1)[1])
    d = master_db.get_distributor(dist_id)
    name = d['name'] if d else str(dist_id)
    master_db.delete_distributor(dist_id)
    bot.edit_message_text(
        f"✅ Доступ дистрибьютора <b>{html.escape(name)}</b> отозван.",
        c.message.chat.id, c.message.message_id,
        reply_markup=types.InlineKeyboardMarkup().add(
            types.InlineKeyboardButton("← К дистрибьюторам", callback_data="acc_dists")
        )
    )
    try:
        bot.send_message(dist_id,
            "⚠️ Ваш доступ к IOL Marketplace RefMaster был отозван администратором.\n"
            "Для восстановления обратитесь к администратору."
        )
    except Exception:
        pass

@bot.callback_query_handler(func=lambda c: c.data == "acc_back")
def acc_back_to_clinics(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    bot.edit_message_text(
        "🏥 <b>Управление доступом</b>\n\nВыберите раздел:",
        c.message.chat.id, c.message.message_id,
        reply_markup=_acc_main_keyboard()
    )

# ── Врач → действия ───────────────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_doc:"))
def acc_show_doctor(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    _, doc_uid_s, cid = c.data.split(":", 2)
    doc_uid = int(doc_uid_s)

    all_users = master_db.get_all_users() or []
    doc = next((u for u in all_users if u.get("telegram_id") == doc_uid and u.get("clinic_id") == cid), None)
    if not doc:
        bot.answer_callback_query(c.id, "Пользователь не найден"); return

    role_label = ROLES_RU.get(doc.get("role", ""), doc.get("role", ""))
    text = (
        f"👤 <b>{html_escape(doc['name'])}</b>\n"
        f"🏥 {html_escape(doc.get('clinic_name', cid))}\n"
        f"🎭 {role_label}  ·  🆔 <code>{doc_uid}</code>"
    )
    kb = types.InlineKeyboardMarkup(row_width=1)
    kb.add(types.InlineKeyboardButton("✉️ Написать в Telegram",         url=f"tg://user?id={doc_uid}"))
    kb.add(types.InlineKeyboardButton("🔄 Перенести в другую клинику", callback_data=f"acc_mv:{doc_uid}:{cid}"))
    kb.add(types.InlineKeyboardButton("🗑 Отозвать доступ",            callback_data=f"acc_rev:{doc_uid}:{cid}"))
    kb.add(types.InlineKeyboardButton("← Назад",                       callback_data=f"acc_cl:{cid}"))
    bot.edit_message_text(text, c.message.chat.id, c.message.message_id, reply_markup=kb)

# ── Отозвать доступ ───────────────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_rev:"))
def acc_revoke_confirm(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    _, doc_uid_s, cid = c.data.split(":", 2)
    doc_uid = int(doc_uid_s)
    all_users = master_db.get_all_users() or []
    doc = next((u for u in all_users if u.get("telegram_id") == doc_uid and u.get("clinic_id") == cid), None)
    doc_name    = doc["name"]            if doc else f"User {doc_uid}"
    clinic_name = doc.get("clinic_name", cid) if doc else cid
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.row(
        types.InlineKeyboardButton("✅ Да, отозвать", callback_data=f"acc_rev_ok:{doc_uid}:{cid}"),
        types.InlineKeyboardButton("← Отмена",        callback_data=f"acc_doc:{doc_uid}:{cid}")
    )
    bot.edit_message_text(
        f"⚠️ Отозвать доступ у <b>{html_escape(doc_name)}</b>\nв клинике <b>{html_escape(clinic_name)}</b>?",
        c.message.chat.id, c.message.message_id, reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_rev_ok:"))
def acc_revoke_execute(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    _, doc_uid_s, cid = c.data.split(":", 2)
    doc_uid = int(doc_uid_s)
    all_users = master_db.get_all_users() or []
    doc = next((u for u in all_users if u.get("telegram_id") == doc_uid and u.get("clinic_id") == cid), None)
    doc_name = doc["name"] if doc else f"User {doc_uid}"
    master_db.delete_user_access(doc_uid, cid)
    try: bot.send_message(doc_uid, "🔇 Ваш доступ в клинику был отозван администратором.")
    except: pass
    bot.edit_message_text(
        f"✅ Доступ <b>{html_escape(doc_name)}</b> отозван.",
        c.message.chat.id, c.message.message_id,
        reply_markup=types.InlineKeyboardMarkup().add(
            types.InlineKeyboardButton("← К клинике", callback_data=f"acc_cl:{cid}")
        )
    )

# ── Перенести в другую клинику ────────────────────────────────────────────────
@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_mv:"))
def acc_move_pick_clinic(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    _, doc_uid_s, from_cid = c.data.split(":", 2)
    doc_uid = int(doc_uid_s)
    all_users = master_db.get_all_users() or []
    doc = next((u for u in all_users if u.get("telegram_id") == doc_uid and u.get("clinic_id") == from_cid), None)
    doc_name = doc["name"] if doc else f"User {doc_uid}"
    others = [cl for cl in _get_clinics() if cl["clinic_id"] != from_cid]
    if not others:
        bot.answer_callback_query(c.id, "Нет других клиник для переноса"); return
    kb = types.InlineKeyboardMarkup(row_width=1)
    for cl in others:
        kb.add(types.InlineKeyboardButton(f"🏥 {cl['name']}", callback_data=f"acc_mv_to:{doc_uid}:{from_cid}:{cl['clinic_id']}"))
    kb.add(types.InlineKeyboardButton("← Назад", callback_data=f"acc_doc:{doc_uid}:{from_cid}"))
    bot.edit_message_text(
        f"🔄 Перенести <b>{html_escape(doc_name)}</b>\nВыберите клинику назначения:",
        c.message.chat.id, c.message.message_id, reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_mv_to:"))
def acc_move_confirm(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    parts = c.data.split(":")
    doc_uid, from_cid, to_cid = int(parts[1]), parts[2], parts[3]
    all_users = master_db.get_all_users() or []
    doc = next((u for u in all_users if u.get("telegram_id") == doc_uid and u.get("clinic_id") == from_cid), None)
    doc_name = doc["name"] if doc else f"User {doc_uid}"
    to_name = to_cid
    try:
        row = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (to_cid,)).fetchone()
        if row: to_name = row[0]
    except: pass
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.row(
        types.InlineKeyboardButton("✅ Перенести", callback_data=f"acc_mv_ok:{doc_uid}:{from_cid}:{to_cid}"),
        types.InlineKeyboardButton("← Назад",      callback_data=f"acc_mv:{doc_uid}:{from_cid}")
    )
    from_name = doc.get("clinic_name", from_cid) if doc else from_cid
    bot.edit_message_text(
        f"🔄 <b>{html_escape(doc_name)}</b>\n"
        f"Из: {html_escape(from_name)}\nВ: <b>{html_escape(to_name)}</b>\n\nПодтвердить?",
        c.message.chat.id, c.message.message_id, reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith("acc_mv_ok:"))
def acc_move_execute(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    parts = c.data.split(":")
    doc_uid, from_cid, to_cid = int(parts[1]), parts[2], parts[3]
    all_users = master_db.get_all_users() or []
    doc = next((u for u in all_users if u.get("telegram_id") == doc_uid and u.get("clinic_id") == from_cid), None)
    doc_name = doc["name"] if doc else f"User {doc_uid}"
    doc_role = doc.get("role", "surgeon") if doc else "surgeon"
    to_name = to_cid
    try:
        row = master_db.execute("SELECT name FROM clinics WHERE clinic_id=?", (to_cid,)).fetchone()
        if row: to_name = row[0]
    except: pass
    master_db.delete_user_access(doc_uid, from_cid)
    master_db.add_user(doc_uid, to_cid, doc_role, doc_name)
    try: bot.send_message(doc_uid, f"🔄 Ваш доступ перемещён в клинику <b>{html_escape(to_name)}</b>.")
    except: pass
    bot.edit_message_text(
        f"✅ <b>{html_escape(doc_name)}</b> перенесён в <b>{html_escape(to_name)}</b>.",
        c.message.chat.id, c.message.message_id,
        reply_markup=types.InlineKeyboardMarkup().add(
            types.InlineKeyboardButton("← К клинике", callback_data=f"acc_cl:{to_cid}")
        )
    )

@bot.message_handler(func=lambda m: m.text == "🏥 Сменить клинику" or m.text == "/clinics")
def switch_clinic_cmd(message):
    uid = message.from_user.id
    clinics = master_db.get_user_clinics(uid)
    
    if not clinics:
        bot.send_message(uid, "У вас нет доступа к клиникам.")
        return
        
    text = "<b>Выберите клинику для работы:</b>"
    kb = types.InlineKeyboardMarkup()
    current_cid = get_ctx(uid)["cid"]
    for cl in clinics:
        prefix = "✅ " if cl['clinic_id'] == current_cid else ""
        kb.add(types.InlineKeyboardButton(f"{prefix}{cl['clinic_name']}", callback_data=f"set_active_cl:{cl['clinic_id']}"))
    
    bot.send_message(uid, text, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("set_active_cl:"))
def handle_set_active_clinic(c):
    uid = c.from_user.id
    cid = c.data.split(":")[1]
    
    master_db.set_active_clinic(uid, cid)
    load_clinic(uid, force_cid=cid)
    cl_info = master_db.get_clinic_by_id(cid)
    name = cl_info["name"] if cl_info else cid
    
    bot.answer_callback_query(c.id, f"Выбрана клиника: {name}")
    bot.edit_message_text(f"✅ Теперь вы работаете в клинике: <b>{name}</b>", c.message.chat.id, c.message.message_id)
    bot.send_message(uid, f"Меню обновлено для <b>{name}</b>", reply_markup=main_menu_markup(uid))

@bot.message_handler(func=lambda m: m.text == "📦 Бэкап базы")
def admin_backup(message):
    uid = message.from_user.id
    context = get_ctx(uid)
    cid = context["cid"]
    role = context["role"]
    
    if role != "admin" and uid not in ADMIN_IDS: return

    cl = master_db.get_clinic_by_id(cid)
    if not cl: return

    # Ищем файл базы
    db_file = cl["db_file"]
    # На сервере базы лежат в /root/medeye/data/
    paths = [db_file, f"/root/medeye/data/{db_file}", f"./{db_file}"]
    
    found = False
    for p in paths:
        if os.path.exists(p):
            with open(p, "rb") as f:
                bot.send_document(message.chat.id, f, caption=f"🔐 Бэкап {cl['name']}")
                found = True
                break
    if not found:
        bot.send_message(message.chat.id, "❌ Файл базы не найден.")

@bot.message_handler(func=lambda m: m.text == "ℹ️ Инфо")
def info_handler(message):
    bot.send_message(message.chat.id, "<b>RefMaster SLIM v2.6.1</b>\n\nЛегкий бот-коннектор для авторизации персонала и управления базами данных.")

@bot.message_handler(commands=['move'])
def move_patient_cmd(message):
    uid = message.from_user.id
    # Проверка прав (только админы)
    context = get_ctx(uid)
    cid = context["cid"]
    role = context["role"]
    
    if not cid or (role != "admin" and uid not in ADMIN_IDS):
        bot.send_message(uid, "❌ У вас нет прав для выполнения этой команды.")
        return

    # Формат: /move <patient_id> <target_clinic_id>
    parts = message.text.split()
    if len(parts) < 3:
        bot.send_message(uid, "📖 <b>Инструкция по переносу:</b>\n\nКоманда: <code>/move ID_пациента ID_целевой_клиники</code>\n\n"
                              "<i>Пример:</i> <code>/move 12 c_fac7df3d</code>\n\n"
                              "Пациент будет удален из текущей клиники и добавлен в новую.")
        return

    pid = parts[1]
    target_cid = parts[2]
    source_cid = cid # Теперь берем из контекста ✅

    if source_cid == target_cid:
        bot.send_message(uid, "⚠️ Пациент уже находится в этой клинике.")
        return

    try:
        from migrate_patient import migrate_patient
        success, res_msg = migrate_patient(pid, source_cid, target_cid, delete_from_source=True)
        if success:
            bot.send_message(uid, f"✅ <b>Перенос завершен!</b>\n\n{res_msg}")
        else:
            bot.send_message(uid, f"❌ <b>Ошибка миграции:</b>\n\n{res_msg}")
    except Exception as e:
        bot.send_message(uid, f"❌ <b>Системная ошибка:</b>\n{str(e)}")

@bot.message_handler(commands=['full_backup'])
def full_backup_cmd(message):
    uid = message.from_user.id
    if uid not in ADMIN_IDS: return
    
    bot.send_message(uid, "⌛ Запуск полного бэкапа всех баз данных...")
    try:
        import subprocess
        # Запускаем скрипт бэкапа
        res = subprocess.run(["python3", "/root/medeye/api/backup_system.py", "create"], capture_output=True, text=True)
        if res.returncode == 0:
            bot.send_message(uid, "✅ Полный бэкап успешно создан на сервере в папке /root/medeye/backups/")
        else:
            bot.send_message(uid, f"❌ Ошибка бэкапа:\n{res.stderr}")
    except Exception as e:
        bot.send_message(uid, f"❌ Ошибка вызова скрипта: {str(e)}")

# ── Бэкап и восстановление прав доступа ──────────────────────────────────────

import json as _json
import io as _io

@bot.message_handler(func=lambda m: m.text == "🛡️ Бэкап прав")
def access_backup_menu(message):
    if message.from_user.id not in ADMIN_IDS: return
    kb = types.InlineKeyboardMarkup(row_width=1)
    kb.add(types.InlineKeyboardButton("📤 Скачать бэкап прав",    callback_data="acbk_export"))
    kb.add(types.InlineKeyboardButton("📥 Восстановить из бэкапа", callback_data="acbk_restore_init"))
    bot.send_message(
        message.chat.id,
        "🛡️ <b>Бэкап прав доступа</b>\n\n"
        "• <b>Скачать бэкап</b> — получить JSON со всеми врачами и клиниками\n"
        "• <b>Восстановить</b> — отправить ранее сохранённый JSON-файл",
        reply_markup=kb
    )

@bot.callback_query_handler(func=lambda c: c.data == "acbk_export")
def acbk_export(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id, "⏳ Формирую бэкап...")
    try:
        users   = master_db.get_all_users() or []
        clinics = _get_clinics()
        data = {
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "clinics": [{"clinic_id": cl["clinic_id"], "name": cl["name"]} for cl in clinics],
            "users": [
                {
                    "telegram_id": u["telegram_id"],
                    "clinic_id":   u["clinic_id"],
                    "clinic_name": u.get("clinic_name", ""),
                    "role":        u["role"],
                    "name":        u["name"],
                }
                for u in users
            ]
        }
        ts   = data["timestamp"].replace(" ", "_").replace(":", "-")
        buf  = _io.BytesIO(_json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
        buf.name = f"access_backup_{ts}.json"
        bot.send_document(
            c.message.chat.id, buf,
            caption=f"🛡️ Бэкап прав доступа\n"
                    f"📅 {data['timestamp']}\n"
                    f"👥 {len(data['users'])} пользователей · 🏥 {len(data['clinics'])} клиник"
        )
    except Exception as e:
        bot.send_message(c.message.chat.id, f"❌ Ошибка: {e}")

@bot.callback_query_handler(func=lambda c: c.data == "acbk_restore_init")
def acbk_restore_init(c):
    if c.from_user.id not in ADMIN_IDS: return
    bot.answer_callback_query(c.id)
    msg = bot.send_message(
        c.message.chat.id,
        "📥 Отправьте JSON-файл бэкапа прав доступа.\n\n"
        "⚠️ Существующие права сохранятся, недостающие будут добавлены."
    )
    bot.register_next_step_handler(msg, acbk_restore_process)

def acbk_restore_process(message):
    if message.from_user.id not in ADMIN_IDS: return
    if not message.document:
        bot.send_message(message.chat.id, "❌ Нужен файл JSON. Попробуйте снова — нажмите '🛡️ Бэкап прав'.")
        return
    try:
        file_info = bot.get_file(message.document.file_id)
        raw       = bot.download_file(file_info.file_path)
        data      = _json.loads(raw.decode("utf-8"))

        users   = data.get("users", [])
        clinics = data.get("clinics", [])

        # 1. Восстанавливаем клиники (если не существуют)
        cl_added = 0
        for cl in clinics:
            cid, name = cl.get("clinic_id"), cl.get("name", "")
            if not cid: continue
            existing = master_db.execute("SELECT 1 FROM clinics WHERE clinic_id=?", (cid,)).fetchone()
            if not existing:
                master_db.execute("INSERT INTO clinics (clinic_id, name) VALUES (?,?)", (cid, name))
                cl_added += 1
        if cl_added:
            master_db.conn.commit()

        # 2. Восстанавливаем пользователей
        restored, skipped = 0, 0
        for u in users:
            uid  = u.get("telegram_id")
            cid  = u.get("clinic_id")
            role = u.get("role", "surgeon")
            name = u.get("name", f"User_{uid}")
            if not uid or not cid: continue
            # Проверяем — уже есть такой доступ?
            existing = master_db.execute(
                "SELECT 1 FROM user_clinics WHERE telegram_id=? AND clinic_id=?", (uid, cid)
            ).fetchone()
            if existing:
                skipped += 1
            else:
                master_db.add_user(uid, cid, role, name)
                restored += 1

        ts = data.get("timestamp", "—")
        bot.send_message(
            message.chat.id,
            f"✅ <b>Восстановление завершено</b>\n\n"
            f"📅 Бэкап от: {ts}\n"
            f"🏥 Клиник добавлено: {cl_added}\n"
            f"👤 Доступов восстановлено: {restored}\n"
            f"⏭ Пропущено (уже есть): {skipped}",
            reply_markup=main_menu_markup(message.from_user.id)
        )
    except _json.JSONDecodeError:
        bot.send_message(message.chat.id, "❌ Неверный формат файла. Нужен JSON из бэкапа.")
    except Exception as e:
        bot.send_message(message.chat.id, f"❌ Ошибка восстановления: {e}")


# ═══════════════════════════════════════════════════════════════
# IOL МАРКЕТПЛЕЙС — блок дистрибьютора
# ═══════════════════════════════════════════════════════════════

import io
import csv

def _dist_menu(uid: int) -> types.InlineKeyboardMarkup:
    kb = types.InlineKeyboardMarkup(row_width=1)
    kb.add(
        types.InlineKeyboardButton("📦 Загрузить остатки (CSV)", callback_data="dist_upload"),
        types.InlineKeyboardButton("📋 Мой склад", callback_data="dist_view"),
        types.InlineKeyboardButton("🗑 Очистить склад", callback_data="dist_clear"),
        types.InlineKeyboardButton("ℹ️ Формат файла", callback_data="dist_format"),
    )
    return kb

# Хранилище ожидающих заявок дистрибьюторов: {uid: {"step": ..., "name": ..., "region": ..., "contact": ...}}
DIST_REG: Dict[int, Dict[str, Any]] = {}

# Активные инвайт-токены для дистрибьюторов: {token: created_at}
DIST_TOKENS: Dict[str, datetime.datetime] = {}

def _send_dist_invite(uid: int):
    """Генерирует и отправляет одноразовую инвайт-ссылку."""
    token = "dist_" + secrets.token_urlsafe(8)
    DIST_TOKENS[token] = datetime.datetime.now()
    bot_info = bot.get_me()
    link = f"https://t.me/{bot_info.username}?start={token}"
    bot.send_message(uid,
        f"🔗 <b>Инвайт-ссылка для дистрибьютора:</b>\n\n"
        f"<code>{link}</code>\n\n"
        f"⚠️ Одноразовая — сгорит после первого использования."
    )

@bot.message_handler(func=lambda m: m.text == "🔗 Пригласить дистрибьютора")
def invite_dist_btn(message):
    if message.from_user.id not in ADMIN_IDS: return
    _send_dist_invite(message.from_user.id)

@bot.message_handler(commands=['gen_dist_link'])
def gen_dist_link_cmd(message):
    if message.from_user.id not in ADMIN_IDS: return
    _send_dist_invite(message.from_user.id)

@bot.callback_query_handler(func=lambda c: c.data == "join_as_dist")
def cb_join_as_dist(c):
    bot.answer_callback_query(c.id)
    bot.delete_message(c.message.chat.id, c.message.message_id)
    # Запускаем тот же флоу что и /join
    uid = c.from_user.id
    if master_db.get_distributor(uid):
        bot.send_message(uid, "✅ Вы уже зарегистрированы. Используйте /distributor.")
        return
    DIST_REG[uid] = {"step": "name"}
    bot.send_message(uid,
        "📦 <b>Регистрация как дистрибьютор IOL</b>\n\n"
        "Введите <b>название вашей компании</b>:"
    )

@bot.message_handler(commands=['join'])
def join_as_distributor_cmd(message):
    """Дистрибьютор сам инициирует регистрацию."""
    uid = message.from_user.id
    if master_db.get_distributor(uid):
        bot.send_message(uid, "✅ Вы уже зарегистрированы как дистрибьютор. Используйте /distributor.")
        return
    # Проверяем, не является ли пользователь уже клиникой
    DIST_REG[uid] = {"step": "name"}
    bot.send_message(uid,
        "📦 <b>Регистрация как дистрибьютор IOL</b>\n\n"
        "Введите <b>название вашей компании</b>:"
    )

@bot.message_handler(func=lambda m: m.from_user.id in DIST_REG and DIST_REG[m.from_user.id].get("step") == "name")
def dist_reg_name(message):
    uid = message.from_user.id
    name = message.text.strip()
    if len(name) < 2:
        bot.send_message(uid, "Слишком короткое название. Попробуйте ещё раз:")
        return
    DIST_REG[uid]["name"] = name
    DIST_REG[uid]["step"] = "region"
    bot.send_message(uid, f"Компания: <b>{html.escape(name)}</b>\n\nВведите <b>регион работы</b> (город/страна):")

@bot.message_handler(func=lambda m: m.from_user.id in DIST_REG and DIST_REG[m.from_user.id].get("step") == "region")
def dist_reg_region(message):
    uid = message.from_user.id
    region = message.text.strip()
    DIST_REG[uid]["region"] = region
    DIST_REG[uid]["step"] = "contact"
    bot.send_message(uid, f"Регион: <b>{html.escape(region)}</b>\n\nВведите <b>контакт</b> для хирургов (Telegram @username или телефон):")

@bot.message_handler(func=lambda m: m.from_user.id in DIST_REG and DIST_REG[m.from_user.id].get("step") == "contact")
def dist_reg_contact(message):
    uid = message.from_user.id
    contact = message.text.strip()
    data = DIST_REG[uid]
    data["contact"] = contact
    data["step"] = "done"

    # Показываем итог пользователю
    bot.send_message(uid,
        f"📋 <b>Заявка на регистрацию:</b>\n\n"
        f"Компания: <b>{html.escape(data['name'])}</b>\n"
        f"Регион: {html.escape(data['region'])}\n"
        f"Контакт: {html.escape(contact)}\n\n"
        "⏳ Заявка отправлена на рассмотрение. Вы получите уведомление после одобрения."
    )

    # Уведомляем всех админов с кнопками одобрить/отклонить
    tg_username = f"@{message.from_user.username}" if message.from_user.username else f"ID:{uid}"
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton("✅ Одобрить", callback_data=f"dist_approve:{uid}"),
        types.InlineKeyboardButton("❌ Отклонить", callback_data=f"dist_reject:{uid}"),
    )
    for admin_id in ADMIN_IDS:
        try:
            bot.send_message(admin_id,
                f"🆕 <b>Заявка дистрибьютора:</b>\n\n"
                f"Пользователь: {tg_username} (ID: {uid})\n"
                f"Компания: <b>{html.escape(data['name'])}</b>\n"
                f"Регион: {html.escape(data['region'])}\n"
                f"Контакт: {html.escape(contact)}",
                reply_markup=kb
            )
        except Exception:
            pass

@bot.callback_query_handler(func=lambda c: c.data.startswith("dist_approve:") or c.data.startswith("dist_reject:"))
def handle_dist_approval(c):
    admin_id = c.from_user.id
    if admin_id not in ADMIN_IDS:
        bot.answer_callback_query(c.id, "Нет прав")
        return

    action, dist_id_str = c.data.split(":", 1)
    dist_id = int(dist_id_str)
    data = DIST_REG.get(dist_id, {})

    if action == "dist_approve":
        if not data.get("name"):
            bot.answer_callback_query(c.id, "Данные заявки не найдены")
            return
        master_db.register_distributor(dist_id, data["name"], data.get("contact"), data.get("region"))
        DIST_REG.pop(dist_id, None)
        bot.answer_callback_query(c.id, "✅ Одобрено")
        bot.edit_message_reply_markup(c.message.chat.id, c.message.message_id, reply_markup=None)
        bot.send_message(c.message.chat.id, f"✅ Дистрибьютор <b>{html.escape(data['name'])}</b> одобрен.")
        try:
            bot.send_message(dist_id,
                f"✅ <b>Ваша заявка одобрена!</b>\n\n"
                f"Добро пожаловать в <b>IOL Marketplace RefMaster</b> 🎉\n\n"
                f"Используйте /distributor для управления складом.\n"
                f"📎 Отправьте CSV-файл с остатками чтобы начать."
            )
        except Exception:
            pass

    else:  # reject
        DIST_REG.pop(dist_id, None)
        bot.answer_callback_query(c.id, "❌ Отклонено")
        bot.edit_message_reply_markup(c.message.chat.id, c.message.message_id, reply_markup=None)
        bot.send_message(c.message.chat.id, "❌ Заявка отклонена.")
        try:
            bot.send_message(dist_id,
                "❌ К сожалению, ваша заявка на регистрацию дистрибьютора отклонена.\n"
                "Свяжитесь с администратором для уточнения."
            )
        except Exception:
            pass

@bot.message_handler(commands=['distributor', 'dist'])
def distributor_cmd(message):
    uid = message.from_user.id
    dist = master_db.get_distributor(uid)
    if not dist:
        if uid in ADMIN_IDS:
            # Админ может зарегистрировать сам себя для теста
            bot.send_message(uid, "Вы не зарегистрированы как дистрибьютор.\nИспользуйте /add_dist @username Название для добавления.")
        else:
            bot.send_message(uid, "⛔ У вас нет доступа дистрибьютора.\nОбратитесь к администратору системы.")
        return
    bot.send_message(
        uid,
        f"🏭 <b>{html.escape(dist['name'])}</b>\n"
        f"Регион: {html.escape(dist.get('region') or '—')}\n"
        f"Контакт: {html.escape(dist.get('contact') or '—')}\n\n"
        "Управление складом IOL-линз:",
        reply_markup=_dist_menu(uid)
    )

@bot.message_handler(commands=['add_dist'])
def add_distributor_cmd(message):
    uid = message.from_user.id
    if uid not in ADMIN_IDS:
        return
    # Формат: /add_dist 123456789 Название Компании | регион | @contact
    parts = message.text.split(None, 2)
    if len(parts) < 3:
        bot.send_message(uid, "Формат: /add_dist <telegram_id> <Название> [| регион | @контакт]")
        return
    try:
        dist_id = int(parts[1])
    except ValueError:
        bot.send_message(uid, "❌ Неверный Telegram ID")
        return
    rest = parts[2].split("|")
    name = rest[0].strip()
    region = rest[1].strip() if len(rest) > 1 else ""
    contact = rest[2].strip() if len(rest) > 2 else ""
    master_db.register_distributor(dist_id, name, contact, region)
    bot.send_message(uid, f"✅ Дистрибьютор <b>{html.escape(name)}</b> (ID: {dist_id}) зарегистрирован.")
    try:
        bot.send_message(dist_id,
            f"✅ Вы зарегистрированы как дистрибьютор IOL в системе MedEye.\n"
            f"Компания: <b>{html.escape(name)}</b>\n\n"
            "Используйте /distributor для управления складом."
        )
    except Exception:
        pass

@bot.message_handler(commands=['list_dist'])
def list_distributors_cmd(message):
    uid = message.from_user.id
    if uid not in ADMIN_IDS:
        return
    dists = master_db.get_all_distributors()
    if not dists:
        bot.send_message(uid, "Дистрибьюторов нет.")
        return
    lines = ["<b>📦 Дистрибьюторы:</b>"]
    for d in dists:
        stock = master_db.get_stock_by_distributor(d['telegram_id'])
        lines.append(f"• <b>{html.escape(d['name'])}</b> (ID: {d['telegram_id']}) — {len(stock)} позиций")
    bot.send_message(uid, "\n".join(lines))

@bot.callback_query_handler(func=lambda c: c.data.startswith("dist_"))
def handle_dist_callback(c):
    uid = c.from_user.id
    dist = master_db.get_distributor(uid)
    if not dist:
        bot.answer_callback_query(c.id, "Нет доступа")
        return

    if c.data == "dist_format":
        bot.answer_callback_query(c.id)
        bot.send_message(uid,
            "📄 <b>Формат CSV-файла:</b>\n\n"
            "Кодировка: UTF-8\n"
            "Разделитель: запятая или точка с запятой\n\n"
            "<code>lens_model,power,quantity,price\n"
            "AcrySof IQ SN60WF,20.0,5,\n"
            "AcrySof IQ SN60WF,20.5,3,120\n"
            "AcrySof IQ SN60WF,21.0,8,120\n"
            "J&J ZCB00,19.5,2,</code>\n\n"
            "• <b>lens_model</b> — название линзы\n"
            "• <b>power</b> — диоптрия (через точку)\n"
            "• <b>quantity</b> — количество штук\n"
            "• <b>price</b> — цена (необязательно)\n\n"
            "Отправьте CSV-файл в этот чат."
        )

    elif c.data == "dist_view":
        bot.answer_callback_query(c.id)
        stock = master_db.get_stock_by_distributor(uid)
        if not stock:
            bot.send_message(uid, "Склад пуст. Загрузите CSV-файл с остатками.")
            return
        # Группируем по модели
        from collections import defaultdict
        by_model = defaultdict(list)
        for item in stock:
            by_model[item['lens_model']].append(item)
        lines = [f"📦 <b>Склад: {html.escape(dist['name'])}</b>", f"Позиций: {len(stock)}\n"]
        for model, items in sorted(by_model.items()):
            total = sum(i['quantity'] for i in items)
            powers = ", ".join(f"{i['power']:.2f}×{i['quantity']}" for i in sorted(items, key=lambda x: x['power']))
            lines.append(f"<b>{html.escape(model)}</b> [{total} шт]\n  {powers}")
        # Отправляем по частям если много
        text = "\n".join(lines)
        if len(text) > 4000:
            text = text[:4000] + "\n... (обрезано)"
        bot.send_message(uid, text)

    elif c.data == "dist_clear":
        bot.answer_callback_query(c.id)
        kb = types.InlineKeyboardMarkup()
        kb.add(
            types.InlineKeyboardButton("✅ Да, очистить", callback_data="dist_clear_confirm"),
            types.InlineKeyboardButton("❌ Отмена", callback_data="dist_cancel"),
        )
        bot.send_message(uid, "⚠️ Очистить весь склад?", reply_markup=kb)

    elif c.data == "dist_clear_confirm":
        bot.answer_callback_query(c.id)
        master_db.update_stock(uid, [])
        bot.send_message(uid, "✅ Склад очищен.", reply_markup=_dist_menu(uid))

    elif c.data == "dist_cancel":
        bot.answer_callback_query(c.id, "Отменено")
        bot.delete_message(uid, c.message.message_id)

    elif c.data == "dist_upload":
        bot.answer_callback_query(c.id)
        bot.send_message(uid, "📎 Отправьте CSV-файл с остатками склада.")

# Обработка CSV-файла от дистрибьютора
@bot.message_handler(content_types=['document'])
def handle_distributor_csv(message):
    uid = message.from_user.id
    dist = master_db.get_distributor(uid)
    if not dist:
        return  # Не дистрибьютор — игнорируем

    doc = message.document
    if not doc.file_name.endswith(('.csv', '.CSV')):
        bot.send_message(uid, "❌ Нужен файл формата .csv\nИспользуйте /dist_format для инструкции.")
        return

    bot.send_message(uid, "⏳ Обрабатываю файл...")
    try:
        file_info = bot.get_file(doc.file_id)
        file_bytes = bot.download_file(file_info.file_path)
        text = file_bytes.decode('utf-8-sig')  # utf-8-sig снимает BOM от Excel

        # Парсим CSV
        reader = csv.DictReader(io.StringIO(text), skipinitialspace=True)
        # Нормализуем заголовки (убираем лишние пробелы, приводим к нижнему регистру)
        reader.fieldnames = [f.strip().lower().replace(' ', '_') for f in (reader.fieldnames or [])]

        items = []
        errors = []
        for i, row in enumerate(reader, 1):
            try:
                model = (row.get('lens_model') or row.get('model') or row.get('линза') or '').strip()
                power_raw = (row.get('power') or row.get('диоптрия') or row.get('d') or '').strip().replace(',', '.')
                qty_raw = (row.get('quantity') or row.get('qty') or row.get('количество') or '').strip()
                price_raw = (row.get('price') or row.get('цена') or '').strip().replace(',', '.')

                if not model or not power_raw or not qty_raw:
                    errors.append(f"Строка {i}: пропущены обязательные поля")
                    continue

                power = float(power_raw)
                qty = int(qty_raw)
                price = float(price_raw) if price_raw else None

                if qty < 0 or power < 0 or power > 50:
                    errors.append(f"Строка {i}: некорректные значения")
                    continue

                items.append({"lens_model": model, "power": power, "quantity": qty, "price": price})
            except (ValueError, KeyError) as e:
                errors.append(f"Строка {i}: {e}")

        if not items:
            bot.send_message(uid, f"❌ Не удалось распознать ни одной позиции.\n" +
                           ("\n".join(errors[:5]) if errors else "Проверьте формат файла (/dist_format)"))
            return

        master_db.update_stock(uid, items)

        msg = (f"✅ <b>Склад обновлён!</b>\n"
               f"Загружено позиций: {len(items)}\n"
               f"Уникальных моделей: {len(set(i['lens_model'] for i in items))}")
        if errors:
            msg += f"\n\n⚠️ Пропущено строк: {len(errors)}\n" + "\n".join(errors[:3])
        bot.send_message(uid, msg, reply_markup=_dist_menu(uid))

    except UnicodeDecodeError:
        bot.send_message(uid, "❌ Ошибка кодировки. Сохраните файл в UTF-8 и попробуйте снова.")
    except Exception as e:
        bot.send_message(uid, f"❌ Ошибка обработки: {e}")


if __name__ == "__main__":
    acquire_lock()
    print("Bot SLIM v2.6.2 is running...")

    bot.set_my_commands([
        types.BotCommand("start",       "🚀 Главное меню"),
        types.BotCommand("menu",        "♻️ Обновить кнопки"),
        types.BotCommand("clinics",     "🏥 Сменить клинику"),
        types.BotCommand("distributor", "📦 Кабинет дистрибьютора"),
        types.BotCommand("join",        "📝 Стать дистрибьютором IOL"),
        types.BotCommand("info",        "ℹ️ Информация"),
    ])

    bot.infinity_polling()
