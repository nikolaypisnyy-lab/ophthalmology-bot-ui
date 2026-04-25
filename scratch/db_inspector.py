import sqlite3
import os
from pathlib import Path

def inspect(path):
    print(f"\n--- Inspecting {path} ---")
    if not Path(path).exists():
        print("File does not exist!")
        return
    try:
        conn = sqlite3.connect(path)
        c = conn.cursor()
        tables = c.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        print(f"Tables: {[t[0] for t in tables]}")
        for t in tables:
            t_name = t[0]
            count = c.execute(f"SELECT COUNT(*) FROM {t_name}").fetchone()[0]
            print(f"  Table '{t_name}' -> {count} rows")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect("/root/medeye/data/master.db")
    # Также проверим другие базы на всякий случай
    for f in Path("/root/medeye/data").glob("*.db"):
        if f.name != "master.db":
            inspect(str(f))
