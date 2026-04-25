import sqlite3

DB_PATH = "/root/medeye/data/master.db"

def restore():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Твой ID и ID второго админа из кода
    doctor_ids = [332670731]
    
    # Привязываем их ко всем клиникам
    clinic_ids = ["c_9d238bbf", "c_test", "c_af854b86"]
    
    for uid in doctor_ids:
        for cid in clinic_ids:
            c.execute("INSERT OR IGNORE INTO users (telegram_id, clinic_id, role, name) VALUES (?, ?, ?, ?)", 
                      (uid, cid, "admin", "Doctor (Restored)"))
            print(f"Restored access for ID {uid} in clinic {cid}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    restore()
