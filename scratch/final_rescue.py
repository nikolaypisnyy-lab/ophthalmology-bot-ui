import sqlite3

OLD_DB = "/root/tmp_zip/deploy/master.db"
NEW_DB = "/root/medeye/data/master.db"

def rescue():
    try:
        old_conn = sqlite3.connect(OLD_DB)
        users = old_conn.execute("SELECT telegram_id, name, role FROM users").fetchall()
        old_conn.close()
        
        new_conn = sqlite3.connect(NEW_DB)
        c = new_conn.cursor()
        
        clinic_ids = ["c_9d238bbf", "c_test", "c_af854b86"]
        
        for uid, name, role in users:
            for cid in clinic_ids:
                # На всякий случай выдаем админа если это врачи, 
                # либо сохраняем роль из старой базы
                actual_role = role if role else "admin"
                c.execute("INSERT OR REPLACE INTO users (telegram_id, clinic_id, role, name) VALUES (?, ?, ?, ?)",
                          (uid, cid, actual_role, name))
                print(f"SUCCESS: Restored {name} ({uid}) to clinic {cid}")
        
        new_conn.commit()
        new_conn.close()
    except Exception as e:
        print(f"ERROR during rescue: {e}")

if __name__ == "__main__":
    rescue()
