import sqlite3, json, random, datetime
db_path = '/root/app/data/clinic_test.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute('DELETE FROM measurements')
c.execute('DELETE FROM visits')
c.execute('DELETE FROM forms')
c.execute('DELETE FROM patients')

names = ['Алексеев','Борисов','Васильев','Григорьев','Дмитриев','Егоров','Жуков','Зиновьев','Иванов','Козлов','Лебедев','Морозов','Новиков','Орлов','Павлов','Румянцев','Смирнов','Тарасов','Устинов','Федоров','Харитонов','Цветков','Чехов','Шестаков','Щербаков','Яковлев'] * 2
start_date = datetime.date(2025, 7, 1)

for i in range(50):
    p_id = str(2000 + i)
    p_name = f"{names[i]} {random.choice(['А.', 'Б.', 'В.', 'Г.'])} {i+1}"
    created_at = (start_date + datetime.timedelta(days=random.randint(0, 180))).isoformat()
    
    c.execute('INSERT INTO patients (patient_id, name, created_at, archived) VALUES (?, ?, ?, 0)', (p_id, p_name, created_at))
    
    def get_eye_data():
        s = -3.0 - random.uniform(0, 4)
        cl = -random.uniform(0.5, 2.0)
        ax = random.randint(0, 180)
        return {
            'uva': '0.1', 'bcva': '1.0',
            'man_sph': f"{s:.2f}", 'man_cyl': f"{cl:.2f}", 'man_ax': str(ax),
            'n_sph': f"{s:.2f}", 'n_cyl': f"{cl:.2f}", 'n_ax': str(ax),
            'c_sph': f"{s + 0.5:.2f}", 'c_cyl': f"{cl:.2f}", 'c_ax': str(ax),
            'k1': '43.50', 'k2': '44.50', 'kavg': '44.00',
            'kercyl': '1.00', 'kerax': '90',
            'cct': '540', 'p_tot_c': '-1.25', 'p_tot_a': '95', 
            'bcva': '1.0'
        }, s, cl, ax
    
    od_data, od_s, od_cl, od_ax = get_eye_data()
    os_data, os_s, os_cl, os_ax = get_eye_data()
    
    primary_data = {
        'patient_type': 'refraction', 'type': 'refraction', 'op_eye': 'OU', 'eye': 'OU',
        'age': str(random.randint(20, 45)), 'sex': 'М',
        'od': od_data, 'os': os_data
    }
    
    c.execute('INSERT INTO forms (patient_id, op_date, op_time, primary_data) VALUES (?, ?, ?, ?)', 
              (p_id, created_at, "10:00", json.dumps(primary_data, ensure_ascii=False)))
    
    v_id = f"v_{p_id}"
    c.execute('INSERT INTO visits (visit_id, patient_id, status, active, created_at) VALUES (?, ?, "done", 1, ?)', (v_id, p_id, created_at))
    
    # REAL SAVED PLAN (not zeros!)
    m_data = {
        'savedPlan': {
            'od': {'sph': f"{od_s:.2f}", 'cyl': f"{od_cl:.2f}", 'ax': str(od_ax)}, 
            'os': {'sph': f"{os_s:.2f}", 'cyl': f"{os_cl:.2f}", 'ax': str(os_ax)}
        },
        'periods': {
            '1m': {
                'od': {'sph': f"{0.50 + random.uniform(-0.1, 0.1):.2f}", 'cyl': '0.00', 'va': '1.0', 'ax': '0'},
                'os': {'sph': f"{0.60 + random.uniform(-0.1, 0.1):.2f}", 'cyl': '0.00', 'va': '1.0', 'ax': '0'}
            }
        }
    }
    c.execute('INSERT INTO measurements (visit_id, data) VALUES (?, ?)', (v_id, json.dumps(m_data)))

conn.commit()
conn.close()
print('DB_REFRESHED_CLEAN_FULL_DATA')
