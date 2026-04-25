import sqlite3
import os
from pathlib import Path

DB_DIR = Path("/root/medeye/data")
MASTER_DB = DB_DIR / "master.db"

def audit():
    if not MASTER_DB.exists():
        print(f"CRITICAL: {MASTER_DB} missing!")
        return

    print(f"--- Master DB Audit ({MASTER_DB}) ---")
    conn = sqlite3.connect(str(MASTER_DB))
    c = conn.cursor()
    try:
        rows = c.execute("SELECT u.user_id, c.clinic_name, c.db_file FROM users_clinics u JOIN clinics c ON u.clinic_id = c.id").fetchall()
        for r in rows:
            uid, name, db_file = r
            db_path = DB_DIR / db_file
            exists = db_path.exists()
            size = db_path.stat().st_size if exists else 0
            
            p_count = 0
            if exists and size > 0:
                try:
                    c2 = sqlite3.connect(str(db_path))
                    p_count = c2.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
                    c2.close()
                except Exception as e:
                    p_count = f"ERR({e})"
            
            print(f"User:{uid} | Clinic:{name} | File:{db_file} | Exists:{exists} | Size:{size} | Patients:{p_count}")
    except Exception as e:
        print(f"Audit Error: {e}")
    conn.close()

if __name__ == "__main__":
    audit()
