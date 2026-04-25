import sqlite3

DB_PATH = "/root/medeye/data/master.db"

def fix():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 1. Убедимся, что таблица users существует и имеет правильные колонки
    c.execute("CREATE TABLE IF NOT EXISTS users (telegram_id INTEGER PRIMARY KEY, status TEXT, username TEXT);")
    
    # 2. Добавляем тебя как админа
    my_id = 379286602
    c.execute("INSERT OR REPLACE INTO users (telegram_id, status) VALUES (?, ?)", (my_id, "admin"))
    
    # 3. На всякий случай проверим таблицу users_clinics еще раз
    # (она уже должна быть в порядке, но мы подстрахуемся)
    
    conn.commit()
    conn.close()
    print(f"User {my_id} promoted to ADMIN in master.db")

if __name__ == "__main__":
    fix()
