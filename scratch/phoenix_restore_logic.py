import os
import re

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Добавляем обработчик для приема файла бэкапа
    restore_logic = \"\"\"
@bot.message_handler(content_types=['document'])
def handle_restore_document(message):
    uid = message.from_user.id
    if uid not in ADMIN_IDS: return
    
    doc = message.document
    if doc.file_name.endswith('.tar.gz') and 'medeye_nuclear' in doc.file_name:
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton("🔥 ДА, ВОССТАНОВИТЬ ВСЁ", callback_data=f"confirm_restore:{doc.file_id}"))
        kb.add(types.InlineKeyboardButton("❌ Отмена", callback_data="cancel_restore"))
        bot.send_message(uid, f"⚠️ <b>ВНИМАНИЕ!</b>\\n\\nВы прислали ядерный бэкап: <code>{doc.file_name}</code>.\\n\\nЕсли вы нажмете кнопку восстановления, текущая версия системы будет ПОЛНОСТЬЮ СТЕРТА и заменена данными из этого архива. Продолжить?", reply_markup=kb)

@bot.callback_query_handler(func=lambda call: call.data.startswith('confirm_restore:'))
def handle_confirm_restore(call):
    uid = call.from_user.id
    if uid not in ADMIN_IDS: return
    file_id = call.data.split(':', 1)[1]
    
    bot.edit_message_text("🚀 <b>Процесс восстановления запущен.</b>\\nБот сейчас отключится на 10-15 секунд и вернется в строй после перезагрузки системы.", call.message.chat.id, call.message.message_id)
    
    try:
        # Скачиваем файл
        file_info = bot.get_file(file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        tmp_path = "/root/medeye_restore_source.tar.gz"
        with open(tmp_path, 'wb') as f:
            f.write(downloaded_file)
            
        # Создаем скрипт-реаниматор
        rescue_script = \"\"\"
import subprocess, time, os, shutil
time.sleep(2) # Даем боту время отправить сообщение и завершиться
try:
    # Останавливаем всё
    subprocess.run(['systemctl', 'stop', 'medeye-app.service'], check=True)
    # Бот (этот скрипт запущен ИЗ бота, так что он умрет сам при остановке сервиса)
    
    # Резервная копия текущей папки
    if os.path.exists('/root/medeye'):
        if os.path.exists('/root/medeye_pre_restore_bak'):
            shutil.rmtree('/root/medeye_pre_restore_bak')
        os.rename('/root/medeye', '/root/medeye_pre_restore_bak')
    
    # Распаковка
    subprocess.run(['tar', '-xzf', '/root/medeye_restore_source.tar.gz', '-C', '/'], check=True)
    
    # Обновляем конфиги сервисов (если они были в архиве)
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    
    # Запускаем всё обратно
    subprocess.run(['systemctl', 'start', 'medeye-app.service'], check=True)
    subprocess.run(['systemctl', 'start', 'medeye_bot.service'], check=True)
    
    os.remove('/root/medeye_restore_source.tar.gz')
    os.remove('/root/rescue_operation.py')
except Exception as e:
    with open('/root/restore_error.log', 'w') as f:
        f.write(str(e))
\"\"\"
        with open('/root/rescue_operation.py', 'w') as f:
            f.write(rescue_script)
            
        # Запускаем скрипт-реаниматор в фоне и убиваем бота
        import subprocess
        subprocess.Popen(['python3', '/root/rescue_operation.py'])
        os._exit(0)
        
    except Exception as e:
        bot.send_message(uid, f"❌ Ошибка подготовки восстановления: {e}")

@bot.callback_query_handler(func=lambda call: call.data == 'cancel_restore')
def handle_cancel_restore(call):
    bot.edit_message_text("❌ Восстановление отменено.", call.message.chat.id, call.message.message_id)
\"\"\"
    
    # Вставляем логику перед другими обработчиками (после импортов и настроек)
    content = content.replace("@bot.message_handler(commands=['start'])", restore_logic + "\\n@bot.message_handler(commands=['start'])")

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Bot updated with PHOENIX restore feature.")

if __name__ == "__main__":
    update_bot()
