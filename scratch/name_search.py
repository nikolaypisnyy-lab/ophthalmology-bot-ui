import sqlite3
import os
from pathlib import Path

DATA_DIR = Path("/root/medeye/data")

def search():
    names = ["Алихан", "Алфирьев", "Alikhan", "Alfiriev"]
    for db_path in DATA_DIR.glob("*.db"):
        try:
            conn = sqlite3.connect(str(db_path))
            c = conn.cursor()
            # Ищем во всех таблицах, где могут быть имена или ID
            tables = c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            for t in [t[0] for t in tables]:
                try:
                    # Поиск по текстовым полям
                    rows = c.execute(f"SELECT * FROM {t}").fetchall()
                    for r in rows:
                        r_str = str(r)
                        for n in names:
                            if n.lower() in r_str.lower():
                                print(f"MATCH in {db_path.name} | Table {t}: {r}")
                except:
                    pass
            conn.close()
        except:
            pass

if __name__ == "__main__":
    search()
