import sqlite3
import datetime

DB_PATH = "/root/medeye/data/master.db"

def repair():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 1. Тотальное удаление всего
    c.execute("DROP TABLE IF EXISTS users_clinics;")
    c.execute("DROP TABLE IF EXISTS clinics;")
    c.execute("DROP TABLE IF EXISTS users;")
    
    # 2. Создание таблиц строго по коду master_db.py
    c.execute("""
        CREATE TABLE clinics (
            clinic_id TEXT PRIMARY KEY,
            name TEXT,
            db_file TEXT,
            created_at TEXT
        )
    """)
    c.execute("""
        CREATE TABLE users (
            telegram_id INTEGER,
            clinic_id TEXT,
            role TEXT,
            name TEXT,
            PRIMARY KEY (telegram_id, clinic_id)
        )
    """)
    
    # 3. Заполняем данными
    my_id = 379286602
    now = datetime.datetime.now().isoformat()
    
    # Клиники
    clinics = [
        ("c_9d238bbf", "DostarMed", "clinic_c_9d238bbf.db"),
        ("c_test", "Test Clinic", "clinic_test.db"),
        ("c_af854b86", "Lucy", "clinic_c_af854b86.db")
    ]
    
    for cid, name, dbf in clinics:
        c.execute("INSERT INTO clinics (clinic_id, name, db_file, created_at) VALUES (?, ?, ?, ?)", (cid, name, dbf, now))
        # Привязываем пользователя к КАЖДОЙ клинике
        c.execute("INSERT INTO users (telegram_id, clinic_id, role, name) VALUES (?, ?, ?, ?)", (my_id, cid, "admin", "Admin"))
        print(f"Restored access to: {name}")
        
    conn.commit()
    conn.close()
    print("Master DB RECONSTRUCTED DEFINITIVELY.")

if __name__ == "__main__":
    repair()
