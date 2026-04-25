import sqlite3, json
conn = sqlite3.connect('/root/medeye/data/clinic_test.db')
c = conn.cursor()
c.execute('SELECT primary_data FROM forms WHERE patient_id = "4000"')
r = c.fetchone()
if r: print(r[0])
else: print('NOT_FOUND')
conn.close()