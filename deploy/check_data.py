import sqlite3
import os
db_path = '/root/medeye/data/clinic_test.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM patients')
    print(f'Patients in test db: {c.fetchone()[0]}')
    c.execute('SELECT name FROM patients LIMIT 3')
    for r in c.fetchall(): print(f'Example: {r[0]}')
    conn.close()
else:
    print('Clinic Test DB NOT FOUND in /root/medeye/data/')