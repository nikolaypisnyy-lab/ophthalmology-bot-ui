import sqlite3

DB_PATH = "/root/medeye/data/master.db"

def fix():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Сносим старую таблицу и создаем новую правильную
    c.execute("DROP TABLE IF EXISTS users;")
    c.execute("""
    CREATE TABLE users (
        telegram_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        username TEXT
    );
    """)
    
    # Добавляем тебя как админа
    my_id = 379286602
    c.execute("INSERT INTO users (telegram_id, status) VALUES (?, ?)", (my_id, "admin"))
    
    conn.commit()
    conn.close()
    print(f"User {my_id} RE-ADDED as admin with NEW schema.")

if __name__ == "__main__":
    fix()
