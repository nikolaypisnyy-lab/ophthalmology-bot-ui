import sqlite3, json
c = sqlite3.connect('/root/app/data/master.db')
c.row_factory = sqlite3.Row
users = [dict(r) for r in c.execute('SELECT * FROM users')]
clinics = {r['clinic_id']: dict(r) for r in c.execute('SELECT * FROM clinics')}
for u in users:
    cl = clinics.get(u['clinic_id'], {})
    print(f"User: {u['telegram_id']}, Clinic: {u['clinic_id']}, DB: {cl.get('db_file')}")
