import sqlite3
import os

DB_PATH = "/root/medeye/data/master.db"

def sweep():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Полная дезинфекция всех таблиц
    tables = ["users_clinics", "clinics", "users"]
    for t in tables:
        try:
            c.execute(f"DELETE FROM {t};")
            print(f"Table {t} cleared.")
        except:
            pass
            
    # Добавляем ТОЛЬКО ТРИ клиники
    my_id = 379286602
    clinic_data = [
        ("c_9d238bbf", "DostarMed", "clinic_c_9d238bbf.db"),
        ("c_test", "Test Clinic", "clinic_test.db"),
        ("c_af854b86", "Lucy", "clinic_c_af854b86.db")
    ]
    
    # Также убедимся что пользователь существует
    try:
        c.execute("INSERT OR REPLACE INTO users (telegram_id, status) VALUES (?, ?)", (my_id, "admin"))
    except:
        pass

    for cid, name, dbf in clinic_data:
        c.execute("INSERT OR REPLACE INTO clinics (id, clinic_name, db_file) VALUES (?, ?, ?)", (cid, name, dbf))
        c.execute("INSERT INTO users_clinics (user_id, clinic_id) VALUES (?, ?)", (my_id, cid))
        print(f"Added: {name}")
    
    conn.commit()
    conn.close()
    print("Sweep complete.")

if __name__ == "__main__":
    sweep()
