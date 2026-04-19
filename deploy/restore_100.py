import json, random, datetime
from database import MedEyeDB

db_path = 'clinic_test.db'
db = MedEyeDB(db_path) # the constructor calls _init_db()

# Clear existing data
db.execute('DELETE FROM measurements', commit=True)
db.execute('DELETE FROM visits', commit=True)
db.execute('DELETE FROM forms', commit=True)
db.execute('DELETE FROM patients', commit=True)

names = ['Антропов','Беляев','Виноградов','Григорьев','Дмитриев','Ермаков','Жуков','Захаров','Ильин','Ковалев','Леонтьев','Максимов','Николаев','Орлов','Павлов','Романов','Сергеев','Тимофеев','Устинов','Федотов']
start_date = datetime.date(2025, 7, 1)

for i in range(100):
    p_id = str(8000 + i)
    p_name = f"{names[i % 20]} {random.choice(['А.', 'Б.', 'В.', 'Г.'])} {p_id}"
    created_at = (start_date + datetime.timedelta(days=random.randint(0, 180))).isoformat()
    
    db.save_patient(p_id, None, p_name, "-", created_at)
    
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
    
    db.save_form(p_id, op_date=created_at, op_time="10:00", primary=p_data)
    
    v_id = f"v_{p_id}"
    db.save_visit(v_id, p_id, "done", True, created_at)
    
    m_data = {
        'manifest': {
            'od': {'sph': float(od['man_sph']), 'cyl': float(od['man_cyl']), 'axis': int(od['man_ax']), 'bcva': 1.0},
            'os': {'sph': float(os['man_sph']), 'cyl': float(os['man_cyl']), 'axis': int(os['man_ax']), 'bcva': 1.0}
        },
        'autoref_narrow': {
            'od': {'sph': float(od['n_sph']), 'cyl': float(od['n_cyl']), 'axis': int(od['n_ax']), 'kavg': 44.0, 'kercyl': 1.0, 'kerax': 90},
            'os': {'sph': float(os['n_sph']), 'cyl': float(os['n_cyl']), 'axis': int(os['n_ax']), 'kavg': 44.0, 'kercyl': 1.0, 'kerax': 90}
        },
        'autoref_cyclo': {
            'od': {'sph': float(od['c_sph']), 'cyl': float(od['c_cyl']), 'axis': int(od['c_ax'])},
            'os': {'sph': float(os['c_sph']), 'cyl': float(os['c_cyl']), 'axis': int(os['c_ax'])}
        },
        'keratometry': {
            'od': {'k1': 43.5, 'k2': 44.5, 'kavg': 44.0, 'kercyl': 1.0, 'axis': 90},
            'os': {'k1': 43.5, 'k2': 44.5, 'kavg': 44.0, 'kercyl': 1.0, 'axis': 90}
        },
        'pentacam': {
            'od': {'tot_cyl': -1.25, 'tot_ax': 95, 'ant_cyl': -1.1, 'ant_ax': 100, 'post_cyl': -0.15, 'post_ax': 90},
            'os': {'tot_cyl': -1.25, 'tot_ax': 95, 'ant_cyl': -1.1, 'ant_ax': 100, 'post_cyl': -0.15, 'post_ax': 90}
        },
        'savedPlan': {
            'od': {'sph': float(od['n_sph']), 'cyl': float(od['man_cyl']), 'axis': int(od['man_ax'])}, 
            'os': {'sph': float(os['n_sph']), 'cyl': float(os['man_cyl']), 'axis': int(os['man_ax'])}
        },
        'periods': {
            '1m': {
                'od': {'sph': f"{random.uniform(0.15, 0.25):.2f}", 'cyl': '0.00', 'va': '1.0', 'ax': '0'},
                'os': {'sph': f"{random.uniform(0.15, 0.25):.2f}", 'cyl': '0.00', 'va': '1.0', 'ax': '0'}
            }
        }
    }
    db.save_meas(v_id, m_data)

print("REFRESHED_SERIES_100_PATIENTS_IN_DEPLOY")
