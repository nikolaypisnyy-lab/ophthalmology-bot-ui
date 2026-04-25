import sqlite3, json, random, datetime
db_path = '/root/medeye/data/clinic_test.db'
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
    p_name = f"{names[i % 20]} {random.choice(['А.', 'Б.', 'В.', 'Г.'])}" 
    created_at = (start_date + datetime.timedelta(days=random.randint(0, 180))).isoformat()
    
    c.execute('INSERT INTO patients (patient_id, name, created_at, archived) VALUES (?, ?, ?, 0)', (p_id, p_name, created_at))
    
    def g():
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
            'p_ant_c': '-1.10', 'p_ant_a': '100', 'p_post_c': '-0.15', 'p_post_a': '90'
        }, s, cl, ax
    
    od, od_s, od_cl, od_ax = g()
    os, os_s, os_cl, os_ax = g()
    
    p_data = {
        'patient_type': 'refraction', 'type': 'refraction', 'op_eye': 'OU', 'eye': 'OU',
        'age': str(random.randint(20, 55)), 'sex': 'М',
        'od': od, 'os': os
    }
    
    c.execute('INSERT INTO forms (patient_id, op_date, op_time, primary_data) VALUES (?, ?, ?, ?)', 
              (p_id, created_at, "10:00", json.dumps(p_data, ensure_ascii=False)))
    
    v_id = f"v_{p_id}"
    c.execute('INSERT INTO visits (visit_id, patient_id, status, active, created_at) VALUES (?, ?, "done", 1, ?)', (v_id, p_id, created_at))
    
    m_data = {
        'manifest': {
            'od': {'sph': float(od['man_sph']), 'cyl': float(od['man_cyl']), 'axis': int(od['man_ax']), 'bcva': 1.0},
            'os': {'sph': float(os['man_sph']), 'cyl': float(os['man_cyl']), 'axis': int(os['man_ax']), 'bcva': 1.0}
        },
        'autoref_narrow': {
            'od': {'sph': float(od['n_sph']), 'cyl': float(od['n_cyl']), 'axis': int(od['n_ax']), 'kavg': 44.0},
            'os': {'sph': float(os['n_sph']), 'cyl': float(os['n_cyl']), 'axis': int(os['n_ax']), 'kavg': 44.0}
        },
        'pentacam': {
            'od': {'tot_cyl': -1.25, 'tot_ax': 95, 'ant_cyl': -1.1, 'ant_ax': 100},
            'os': {'tot_cyl': -1.25, 'tot_ax': 95, 'ant_cyl': -1.1, 'ant_ax': 100}
        },
        'savedPlan': {
            'od': {'sph': float(od['n_sph']), 'cyl': float(od['man_cyl']), 'axis': int(od['man_ax'])}, 
            'os': {'sph': float(os['n_sph']), 'cyl': float(os['man_cyl']), 'axis': int(os['man_ax'])}
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
print("REFRESHED_SERIES_5000")
