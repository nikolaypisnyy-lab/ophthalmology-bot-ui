import sqlite3
import os

DB_PATHS = ["/root/medeye/api/medeye.db", "/root/medeye/data/medeye.db"]

def rescue():
    for db in DB_PATHS:
        if not os.path.exists(db): continue
        print(f"=== CHECKING {db} ===")
        try:
            conn = sqlite3.connect(db)
            # Проверяем таблицу users
            rows = conn.execute("SELECT * FROM users").fetchall()
            for r in rows:
                print(f"FOUND: {r}")
            conn.close()
        except Exception as e:
            print(f"Error reading {db}: {e}")

if __name__ == "__main__":
    rescue()
