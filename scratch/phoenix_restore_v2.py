import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    inserted = False
    for line in lines:
        if not inserted and "@bot.message_handler(commands=['start'])" in line:
            new_lines.append("\n@bot.message_handler(content_types=['document'])\n")
            new_lines.append("def handle_restore_document(message):\n")
            new_lines.append("    uid = message.from_user.id\n")
            new_lines.append("    if uid not in ADMIN_IDS: return\n")
            new_lines.append("    doc = message.document\n")
            new_lines.append("    if doc.file_name.endswith('.tar.gz') and 'medeye_nuclear' in doc.file_name:\n")
            new_lines.append("        kb = types.InlineKeyboardMarkup()\n")
            new_lines.append("        kb.add(types.InlineKeyboardButton('🔥 ДА, ВОССТАНОВИТЬ ВСЁ', callback_data=f'confirm_restore:{doc.file_id}'))\n")
            new_lines.append("        kb.add(types.InlineKeyboardButton('❌ Отмена', callback_data='cancel_restore'))\n")
            new_lines.append("        bot.send_message(uid, f'⚠️ <b>ВНИМАНИЕ!</b>\\n\\nВы прислали ядерный бэкап: <code>{doc.file_name}</code>.\\n\\nЕсли вы нажмете кнопку восстановления, текущая версия системы будет ПОЛНОСТЬЮ СТЕРТА и заменена данными из этого архива. Продолжить?', reply_markup=kb)\n\n")
            
            new_lines.append("@bot.callback_query_handler(func=lambda call: call.data.startswith('confirm_restore:'))\n")
            new_lines.append("def handle_confirm_restore(call):\n")
            new_lines.append("    uid = call.from_user.id\n")
            new_lines.append("    if uid not in ADMIN_IDS: return\n")
            new_lines.append("    file_id = call.data.split(':', 1)[1]\n")
            new_lines.append("    bot.edit_message_text('🚀 <b>Процесс восстановления запущен.</b>\\nБот сейчас отключится на 10-15 секунд и вернется в строй.', call.message.chat.id, call.message.message_id)\n")
            new_lines.append("    try:\n")
            new_lines.append("        file_info = bot.get_file(file_id)\n")
            new_lines.append("        downloaded_file = bot.download_file(file_info.file_path)\n")
            new_lines.append("        tmp_path = '/root/medeye_restore_source.tar.gz'\n")
            new_lines.append("        with open(tmp_path, 'wb') as f: f.write(downloaded_file)\n")
            new_lines.append("        rescue_script = \"\"\"\n")
            new_lines.append("import subprocess, time, os, shutil\n")
            new_lines.append("time.sleep(2)\n")
            new_lines.append("try:\n")
            new_lines.append("    subprocess.run(['systemctl', 'stop', 'medeye-app.service'], check=True)\n")
            new_lines.append("    if os.path.exists('/root/medeye'):\n")
            new_lines.append("        if os.path.exists('/root/medeye_pre_restore_bak'): shutil.rmtree('/root/medeye_pre_restore_bak')\n")
            new_lines.append("        os.rename('/root/medeye', '/root/medeye_pre_restore_bak')\n")
            new_lines.append("    subprocess.run(['tar', '-xzf', '/root/medeye_restore_source.tar.gz', '-C', '/'], check=True)\n")
            new_lines.append("    subprocess.run(['systemctl', 'daemon-reload'], check=True)\n")
            new_lines.append("    subprocess.run(['systemctl', 'start', 'medeye-app.service'], check=True)\n")
            new_lines.append("    subprocess.run(['systemctl', 'start', 'medeye_bot.service'], check=True)\n")
            new_lines.append("    if os.path.exists('/root/medeye_restore_source.tar.gz'): os.remove('/root/medeye_restore_source.tar.gz')\n")
            new_lines.append("except Exception as e:\n")
            new_lines.append("    with open('/root/restore_error.log', 'w') as f: f.write(str(e))\n")
            new_lines.append("\"\"\"\n")
            new_lines.append("        with open('/root/rescue_operation.py', 'w') as f: f.write(rescue_script)\n")
            new_lines.append("        import subprocess\n")
            new_lines.append("        subprocess.Popen(['python3', '/root/rescue_operation.py'])\n")
            new_lines.append("        os._exit(0)\n")
            new_lines.append("    except Exception as e: bot.send_message(uid, f'❌ Ошибка: {e}')\n\n")
            
            new_lines.append("@bot.callback_query_handler(func=lambda call: call.data == 'cancel_restore')\n")
            new_lines.append("def handle_cancel_restore(call):\n")
            new_lines.append("    bot.edit_message_text('❌ Восстановление отменено.', call.message.chat.id, call.message.message_id)\n\n")
            inserted = True
        
        new_lines.append(line)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Bot updated with PHOENIX restore v2.")

if __name__ == "__main__":
    update_bot()
