import sqlite3

def run_fix():
    try:
        conn = sqlite3.connect('/root/medeye/api/master.db')
        cur = conn.cursor()
        
        # 1. Убеждаемся, что клиника прописана (правильное имя колонки clinic_id)
        cur.execute("""
            INSERT OR IGNORE INTO clinics (clinic_id, name, db_file) 
            VALUES (?, ?, ?)
        """, ('c_af854b86', 'MedEye Main (Lucy)', 'clinic_c_af854b86.db'))
        
        # 2. Убеждаемся, что пользователь привязан к этой клинике
        cur.execute("""
            INSERT OR IGNORE INTO users (telegram_id, clinic_id, role, name) 
            VALUES (?, ?, ?, ?)
        """, (379286602, 'c_af854b86', 'admin', 'Niko (Main)'))

        conn.commit()
        print("Success: Access to c_af854b86 restored!")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_fix()
