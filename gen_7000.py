import sqlite3, json, random, datetime
db_path = '/root/app/data/clinic_test.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute('DELETE FROM measurements')
c.execute('DELETE FROM visits')
c.execute('DELETE FROM forms')
c.execute('DELETE FROM patients')

names = ['Антропов','Беляев','Виноградов','Григорьев','Дмитриев','Ермаков','Жуков','Захаров','Ильин','Ковалев','Леонтьев','Максимов','Николаев','Орлов','Павлов','Романов','Сергеев','Тимофеев','Устинов','Федотов']
start_date = datetime.date(2025, 7, 1)

for i in range(100):
    p_id = str(7000 + i)
    p_name = f'{names[i 