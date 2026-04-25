import sqlite3
import os

DB_PATH = "/root/medeye/data/master.db"

def fix():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 1. Посмотрим кто есть в базе
    try:
        users = c.execute("SELECT * FROM users_clinics").fetchall()
        print(f"Current users_clinics: {users}")
    except Exception as e:
        print(f"Error reading users_clinics: {e}")
        
    # 2. Добавляем ID 379286602 еще раз на всякий случай
    my_id = 379286602
    for cid in ["c_9d238bbf", "c_test", "c_af854b86"]:
        c.execute("INSERT OR IGNORE INTO users_clinics (user_id, clinic_id) VALUES (?, ?)", (my_id, cid))
    
    conn.commit()
    conn.close()
    print("Rights fixed.")

if __name__ == "__main__":
    fix()
