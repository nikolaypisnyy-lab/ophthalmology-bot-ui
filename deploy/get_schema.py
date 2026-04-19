import sqlite3
def get_schema():
    conn = sqlite3.connect('/root/medeye_bot/master.db')
    cur = conn.cursor()
    cur.execute("SELECT sql FROM sqlite_master WHERE type='table'")
    for row in cur.fetchall():
        print(row[0])
    conn.close()
get_schema()
