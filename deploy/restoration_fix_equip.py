import sqlite3

def run_fix():
    try:
        conn = sqlite3.connect('/root/medeye/api/master.db')
        cur = conn.cursor()
        
        # 1. Прописываем клинику Оборудования (если ее там нет)
        cur.execute("""
            INSERT OR IGNORE INTO clinics (clinic_id, name, db_file) 
            VALUES (?, ?, ?)
        """, ('c_661e8101', 'Clinic Equipment Journal', 'clinic_c_661e8101.db'))
        
        # 2. Привязываем пользователя к клинике оборудования
        cur.execute("""
            INSERT OR IGNORE INTO users (telegram_id, clinic_id, role, name) 
            VALUES (?, ?, ?, ?)
        """, (379286602, 'c_661e8101', 'admin', 'Niko (Equip)'))

        conn.commit()
        print("Success: Equipment Journal Access restored!")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_fix()
