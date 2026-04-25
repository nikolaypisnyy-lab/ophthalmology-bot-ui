import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Удаляем физическую кнопку из разметки меню
    content = content.replace('kb.row("ℹ️ Инфо")', '# Кнопка инфо удалена')
    # Также удаляем сам обработчик, чтобы не висел лишний код
    import re
    handler_pattern = re.compile(r"@bot\.message_handler\(func=lambda m: m\.text == \"ℹ️ Инфо\"\).*?bot\.send_message\(message\.chat\.id, \"<b>RefMaster SLIM v2\.6\.1</b>.*?\"\)", re.DOTALL)
    content = handler_pattern.sub("", content)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Info button removed from bot.")

if __name__ == "__main__":
    update()
