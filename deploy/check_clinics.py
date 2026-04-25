import sqlite3
conn = sqlite3.connect('/root/medeye/data/master.db')
c = conn.cursor()
c.execute('SELECT * FROM clinics')
for r in c.fetchall(): print(r)
conn.close()