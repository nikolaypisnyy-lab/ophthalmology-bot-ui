import sqlite3, json, random, datetime
db_path = '/root/app/data/clinic_test.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute('DELETE FROM measurements')
c.execute('DELETE FROM visits')
c.execute('DELETE FROM forms')
c.execute('DELETE FROM patients')

names = ['Абрамов','Бирюков','Вавилов','Галкин','Данилов','Елисеев','Жданов','Зайцев','Игнатов','Капустин','Лазарев','Макаров','Никитин','Олегин','Прохоров','Распутин','Савельев','Титов','Уваров','Филиппов']
start_date = datetime.date(2025, 7, 1)

for i in range(50):
    p_id = str(5000 + i)
    p_name = f'{names[i 