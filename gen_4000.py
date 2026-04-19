import sqlite3, json, random, datetime
db_path = '/root/app/data/clinic_test.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute('DELETE FROM measurements')
c.execute('DELETE FROM visits')
c.execute('DELETE FROM forms')
c.execute('DELETE FROM patients')

names = ['Иванов','Петров','Сидоров','Кузнецов','Попов','Васильев','Павлов','Соколов','Михайлов','Новиков','Федоров','Морозов','Волков','Алексеев','Лебедев','Семенов','Егоров','Козлов','Степанов','Николаев']
start_date = datetime.date(2025, 7, 1)

for i in range(50):
    p_id = str(4000 + i)
    p_name = f'{names[i 