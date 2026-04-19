#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import datetime
import fcntl
import html
import threading
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
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True)
    
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
            kb.row("⚙️ Управление клиниками", "📦 Бэкап базы")
            kb.row("🚀 Full Backup (Code+DB)")
    
    kb.row("ℹ️ Инфо")
    return kb

# ================= HANDLERS =================
@bot.message_handler(commands=['start'])
def start_cmd(message):
    uid = message.from_user.id
    u = master_db.get_user_clinic(uid)
    
    if not u:
        text = (
            "👋 Добро пожаловать в <b>RefMaster</b>.\n\n"
            "Вы еще не авторизованы. Для получения доступа к вашей клинике, пожалуйста, "
            "нажмите кнопку ниже, чтобы отправить запрос администратору."
        )
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton("📝 Запросить доступ", callback_data=f"req_access:{uid}"))
        bot.send_message(uid, text, reply_markup=kb)
        return

    bot.send_message(uid, f"👋 Приветствуем, {u['name']}!\nКлиника: <b>{u['clinic_name']}</b>", 
                     reply_markup=main_menu_markup(uid))

@bot.callback_query_handler(func=lambda c: c.data.startswith("req_access:"))
def handle_access_request(c):
    uid = c.from_user.id
    name = f"{c.from_user.first_name or ''} {c.from_user.last_name or ''}".strip() or f"User_{uid}"
    
    text = f"📥 <b>Новая заявка на доступ:</b>\n\nИмя: {html_escape(name)}\nID: <code>{uid}</code>\nUser: @{c.from_user.username or 'none'}"
    
    clinics = master_db.get_all_clinics() if hasattr(master_db, 'get_all_clinics') else []
    # Если метода нет, попробуем вытащить через SQL
    if not clinics:
        rows = master_db.execute("SELECT * FROM clinics").fetchall()
        clinics = [dict(r) for r in rows]

    for admin_id in ADMIN_IDS:
        for cl in clinics:
            kb = types.InlineKeyboardMarkup()
            kb.row(
                types.InlineKeyboardButton("Хирург", callback_data=f"adm_grant:{uid}:surgeon:{cl['clinic_id']}"),
                types.InlineKeyboardButton("Диагностика", callback_data=f"adm_grant:{uid}:diagnostic:{cl['clinic_id']}")
            )
            bot.send_message(admin_id, f"{text}\nКлиника: <b>{cl['name']}</b>", reply_markup=kb)
    
    bot.edit_message_text("✅ Запрос отправлен администратору. Ожидайте уведомления.", c.message.chat.id, c.message.message_id)

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_grant:"))
def handle_admin_grant(c):
    if c.from_user.id not in ADMIN_IDS: return
    parts = c.data.split(":")
    if len(parts) != 4: return
    
    target_uid = int(parts[1])
    role = parts[2]
    cid = parts[3]
    
    # Пытаемся получить имя
    name = f"Сотрудник {target_uid}"
    try:
        user_info = bot.get_chat(target_uid)
        name = f"{user_info.first_name or ''} {user_info.last_name or ''}".strip() or name
    except: pass

    master_db.add_user(target_uid, cid, role, name)
    
    bot.edit_message_text(f"✅ Доступ выдан!\nСотрудник: {name}\nКлиника: {cid}\nРоль: {role}", c.message.chat.id, c.message.message_id)
    
    bot.send_message(target_uid, f"🎉 Вам выдан доступ в клинику <b>{cid}</b>!\nРоль: <b>{role}</b>\n\nТеперь вы можете открыть WebApp.", 
                     reply_markup=main_menu_markup(target_uid))

@bot.message_handler(func=lambda m: m.text == "⚙️ Управление клиниками")
def admin_clinics(message):
    if message.from_user.id not in ADMIN_IDS: return
    
    rows = master_db.execute("SELECT * FROM clinics").fetchall()
    clinics = [dict(r) for r in rows]
    
    if not clinics:
        bot.send_message(message.chat.id, "Список клиник пуст.")
        return

    text = "<b>Управление клиниками:</b>\n\n"
    kb = types.InlineKeyboardMarkup()
    for c in clinics:
        text += f"• {html_escape(c['name'])} (<code>{c['clinic_id']}</code>)\n"
        kb.row(
            types.InlineKeyboardButton(f"🖊 Имя", callback_data=f"adm_ren_init:{c['clinic_id']}"),
            types.InlineKeyboardButton(f"❌ Удалить", callback_data=f"adm_del_init:{c['clinic_id']}")
        )
    
    kb.add(types.InlineKeyboardButton("➕ Создать клинику", callback_data="admin:create_init"))
    bot.send_message(message.chat.id, text, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_del_init:"))
def admin_delete_init(c):
    cid = c.data.split(":")[1]
    kb = types.InlineKeyboardMarkup()
    kb.row(
        types.InlineKeyboardButton("✅ ДА, УДАЛИТЬ", callback_data=f"adm_del_confirm:{cid}"),
        types.InlineKeyboardButton("🔙 Отмена", callback_data="admin_clinics_refresh")
    )
    bot.edit_message_text(f"⚠️ <b>ВНИМАНИЕ!</b>\n\nВы собираетесь удалить клинику <code>{cid}</code>.\nВсе доступы врачей будут аннулированы. Продолжить?", c.message.chat.id, c.message.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data == "admin_clinics_refresh")
def admin_clinics_refresh(c):
    # Просто возвращаемся к списку
    class FakeMsg:
        def __init__(self, c):
            self.from_user = c.from_user
            self.chat = c.message.chat
            self.text = "⚙️ Управление клиниками"
    admin_clinics(FakeMsg(c))

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_del_confirm:"))
def admin_delete_confirm(c):
    if c.from_user.id not in ADMIN_IDS: return
    cid = c.data.split(":")[1]
    
    db_file = master_db.delete_clinic(cid)
    bot.edit_message_text(f"✅ Клиника <b>{cid}</b> удалена.\n\nФайл базы <code>{db_file}</code> сохранен на сервере для архива.", c.message.chat.id, c.message.message_id)

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_ren_init:"))
def admin_rename_init(c):
    cid = c.data.split(":")[1]
    bot.send_message(c.message.chat.id, f"Введите НОВОЕ название для клиники <code>{cid}</code>:")
    bot.register_next_step_handler(c.message, admin_rename_final, cid)

def admin_rename_final(message, cid):
    new_name = message.text.strip()
    if not new_name: return
    
    master_db.rename_clinic(cid, new_name)
    bot.send_message(message.chat.id, f"✅ Клиника <code>{cid}</code> теперь называется <b>{new_name}</b>.", reply_markup=main_menu_markup(message.from_user.id))

@bot.callback_query_handler(func=lambda c: c.data == "admin:create_init")
def admin_create_init(c):
    bot.send_message(c.message.chat.id, "Введите данные клиники в формате:\n<code>ID Название</code>\n(например: <code>distarmed ДистарМед</code>)\n\nИли просто <b>Название</b> (ID создастся сам):")
    bot.register_next_step_handler(c.message, admin_create_final)

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
    load_clinic(uid, force_cid=cid)
        
    bot.send_message(message.chat.id, f"✅ Клиника <b>{name}</b> создана!\nID: <code>{cid}</code>\n\nВы автоматически назначены администратором этой клиники.", reply_markup=main_menu_markup(uid))

@bot.message_handler(func=lambda m: m.text == "👥 Управление доступом")
def admin_users(message):
    if message.from_user.id not in ADMIN_IDS: return
    
    users = master_db.get_all_users()
    if not users:
        bot.send_message(message.chat.id, "Список пользователей пуст.")
        return

    text = "<b>Управление доступом сотрудников:</b>\n\n"
    # Группируем по клиникам
    current_cl = ""
    for u in users:
        if u["clinic_name"] != current_cl:
            current_cl = u["clinic_name"]
            text += f"\n🏥 <b>{html_escape(current_cl)}</b>\n"
        
        roles = {"admin": "Админ", "surgeon": "Хирург", "diagnostic": "Диагност"}
        role_label = roles.get(u["role"], u["role"])
        
        text += f"• {html_escape(u['name'])} (<code>{u['telegram_id']}</code>) — {role_label} "
        
        # Кнопка удаления только если это не сам админ (чтобы себя не удалить случайно)
        if u["telegram_id"] != message.from_user.id:
             text += f"/revoke_{u['telegram_id']}_{u['clinic_id']}\n"
        else:
             text += "\n"

    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text.startswith("/revoke_"))
def handle_revoke_link(message):
    if message.from_user.id not in ADMIN_IDS: return
    parts = message.text.split("_")
    if len(parts) != 3: return
    
    uid = int(parts[1])
    cid = parts[2]
    
    kb = types.InlineKeyboardMarkup()
    kb.row(
        types.InlineKeyboardButton("🗑 ОТЗВАТЬ ДОСТУП", callback_data=f"adm_revoke_cfm:{uid}:{cid}"),
        types.InlineKeyboardButton("🔙 Отмена", callback_data="admin_users_refresh")
    )
    bot.send_message(message.chat.id, f"⚠️ Вы хотите отозвать доступ у пользователя <code>{uid}</code> в клинике <code>{cid}</code>?", reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("adm_revoke_cfm:"))
def admin_revoke_confirm(c):
    if c.from_user.id not in ADMIN_IDS: return
    parts = c.data.split(":")
    uid = int(parts[1])
    cid = parts[2]
    
    master_db.delete_user_access(uid, cid)
    bot.edit_message_text(f"✅ Доступ пользователя <code>{uid}</code> в клинике <code>{cid}</code> отозван.", c.message.chat.id, c.message.message_id)
    # Посылаем врачу уведомление
    try: bot.send_message(uid, f"🔇 Ваш доступ в клинику <b>{cid}</b> был отозван администратором.")
    except: pass

@bot.callback_query_handler(func=lambda c: c.data == "admin_users_refresh")
def admin_users_refresh(c):
    # Просто возвращаемся к списку
    class FakeMsg:
        def __init__(self, c):
            self.from_user = c.from_user
            self.chat = c.message.chat
            self.text = "👥 Управление доступом"
    admin_users(FakeMsg(c))

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
    # На сервере базы лежат в /root/app/data/
    paths = [db_file, f"/root/app/data/{db_file}", f"./{db_file}"]
    
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

@bot.message_handler(func=lambda m: m.text == "🚀 Full Backup (Code+DB)")
@bot.message_handler(commands=['full_backup'])
def full_backup_cmd(message):
    uid = message.from_user.id
    if uid not in ADMIN_IDS: return
    
    bot.send_message(uid, "⌛ Запуск полного бэкапа всех баз данных...")
    try:
        import subprocess
        # Запускаем скрипт бэкапа
        res = subprocess.run(["python3", "/root/medeye_bot/backup_system.py", "create"], capture_output=True, text=True)
        if res.returncode == 0:
            bot.send_message(uid, "✅ Полный бэкап успешно создан на сервере в папке /root/app/backups/")
        else:
            bot.send_message(uid, f"❌ Ошибка бэкапа:\n{res.stderr}")
    except Exception as e:
        bot.send_message(uid, f"❌ Ошибка вызова скрипта: {str(e)}")

if __name__ == "__main__":
    acquire_lock()
    print("Bot SLIM v2.6.1 is running...")
    bot.infinity_polling()
