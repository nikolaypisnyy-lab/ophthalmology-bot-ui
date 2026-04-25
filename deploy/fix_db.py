import sqlite3
conn = sqlite3.connect('/root/medeye/api/master.db')
c = conn.cursor()
c.execute("INSERT OR IGNORE INTO clinics (clinic_id, name, db_file, created_at) VALUES ('test_clinic_999', 'Clinic Test', 'clinic_test.db', '2026-04-18')")
c.execute("INSERT OR IGNORE INTO users (telegram_id, clinic_id, role, name) SELECT DISTINCT telegram_id, 'test_clinic_999', 'admin', 'Test User' FROM users")
conn.commit()
conn.close()
print('Remote DB fixed!')