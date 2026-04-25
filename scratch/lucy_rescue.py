import sqlite3

LUCY_DB = "/opt/lucybot/hospital.db"

def rescue():
    try:
        conn = sqlite3.connect(LUCY_DB)
        # В hospital.db таблица может называться users или admins
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        print(f"Tables in Lucy: {tables}")
        
        for t in [t[0] for t in tables]:
            if "user" in t.lower() or "admin" in t.lower():
                rows = conn.execute(f"SELECT * FROM {t}").fetchall()
                print(f"--- DATA FROM {t} ---")
                for r in rows:
                    print(r)
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    rescue()
