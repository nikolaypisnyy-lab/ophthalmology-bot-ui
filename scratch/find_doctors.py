import sqlite3
import os
import subprocess
from pathlib import Path

DATA_DIR = Path("/root/medeye/data")
NAMES = ["Алихан", "Алфирьев", "Денис", "Alikhan", "Alfiriev", "Denis"]

def scan_dbs():
    print("=== SCANNING CLINIC DATABASES ===")
    for db_path in DATA_DIR.glob("*.db"):
        if db_path.name == "master.db": continue
        try:
            conn = sqlite3.connect(str(db_path))
            # Проверка таблицы users
            try:
                users = conn.execute("SELECT * FROM users").fetchall()
                if users: print(f"FOUND users in {db_path.name}: {users}")
            except: pass
            
            # Поиск имен по всей базе
            tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            for t in [t[0] for t in tables]:
                try:
                    rows = conn.execute(f"SELECT * FROM {t}").fetchall()
                    for r in rows:
                        r_str = str(r)
                        for n in NAMES:
                            if n.lower() in r_str.lower():
                                print(f"MATCH in {db_path.name} | {t}: {r}")
                except: pass
            conn.close()
        except: pass

def scan_logs():
    print("\n=== SCANNING SYSTEM LOGS ===")
    cmd = "journalctl -u medeye_bot.service --since '2 weeks ago' --no-pager"
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        for line in res.stdout.split('\n'):
            for n in NAMES:
                if n.lower() in line.lower():
                    print(f"LOG MATCH: {line[:200]}")
    except: pass

if __name__ == "__main__":
    scan_dbs()
    scan_logs()
