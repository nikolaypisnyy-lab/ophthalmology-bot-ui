import sqlite3
import uuid
import random
from datetime import datetime, timedelta
import json

MASTER_DB = 'master.db'
CLINIC_NAME = 'Clinic Test'
CLINIC_ID = 'test_clinic_999'

def setup_test_clinic():
    # Detect the correct master.db location
    master_path = '/root/app/data/master.db' if os.path.exists('/root/app/data/master.db') else MASTER_DB
    clinic_db_path = '/root/app/data/clinic_test.db' if os.path.exists('/root/app/data') else 'clinic_test.db'

    # 1. Update master.db
    conn = sqlite3.connect(master_path)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO clinics (clinic_id, name, db_file, created_at) VALUES (?, ?, ?, ?)", 
              (CLINIC_ID, CLINIC_NAME, 'clinic_test.db', datetime.now().isoformat()))
    # Also link the user 379286602 specifically just in case
    c.execute("INSERT OR REPLACE INTO users (telegram_id, clinic_id, role, name) VALUES (?, ?, ?, ?)",
              (379286602, CLINIC_ID, 'admin', 'Test Doctor'))
    conn.commit()
    conn.close()

    # 2. Setup clinic_test.db with CORRECT SCHEMA
    if os.path.exists(clinic_db_path):
        os.remove(clinic_db_path)
        
    conn = sqlite3.connect(clinic_db_path)
    c = conn.cursor()
    
    # Matching database.py schema exactly
    c.execute('''CREATE TABLE patients (
                 patient_id TEXT PRIMARY KEY,
                 chat_id INTEGER,
                 name TEXT,
                 phone TEXT,
                 created_at TEXT,
                 archived INTEGER DEFAULT 0)''')
    
    c.execute("CREATE TABLE forms (patient_id TEXT PRIMARY KEY, op_date TEXT, op_time TEXT, primary_data TEXT)")
    c.execute("CREATE TABLE visits (visit_id TEXT PRIMARY KEY, patient_id TEXT, status TEXT, active INTEGER, created_at TEXT)")
    c.execute("CREATE TABLE measurements (visit_id TEXT PRIMARY KEY, data TEXT)")
    c.execute("CREATE TABLE post_op (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT, date TEXT, period TEXT, summary TEXT, notes TEXT, data TEXT, created_at TEXT)")
    c.execute("CREATE TABLE users (user_id TEXT PRIMARY KEY, role TEXT)")
    c.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)")
    
    c.execute("INSERT INTO meta (key, value) VALUES ('next_patient_id', '1000')")

    # 3. Generate 25 biased patients
    names = ["Тест Иван", "Проба Мария", "Сдвиг Алексей", "Ноль Елена", "Умный Дмитрий"]
    
    for i in range(25):
        p_id = str(1000 + i)
        name = random.choice(names) + f" {i}"
        target = 0.0
        # Bias: +0.50D
        actual_sph = 0.50 + random.uniform(-0.15, 0.15)
        actual_sph = round(actual_sph * 4) / 4.0 # round to 0.25
        
        date_str = (datetime.now() - timedelta(days=random.randint(10, 60))).strftime('%Y-%m-%d')
        created_at = (datetime.now() - timedelta(days=90)).isoformat()
        
        # Save Patient
        c.execute("INSERT INTO patients (patient_id, name, created_at) VALUES (?, ?, ?)", (p_id, name, created_at))
        
        # Save Form (patient_type, op_date)
        primary = {"patient_type": "refraction", "op_eye": "OD", "age": "35", "sex": "M"}
        c.execute("INSERT INTO forms (patient_id, op_date, primary_data) VALUES (?, ?, ?)", 
                  (p_id, date_str, json.dumps(primary)))
        
        # Save Visit
        v_id = f"V-{p_id}-test"
        c.execute("INSERT INTO visits (visit_id, patient_id, status, active, created_at) VALUES (?, ?, ?, ?, ?)",
                  (v_id, p_id, "done", 0, created_at))
        
        # Save Measurements (savedPlan and periods)
        plan = {"od": {"sph": 0.0, "cyl": 0.0, "ax": 0}}
        periods = {
            "1m": {
                "od": { "sph": str(actual_sph), "cyl": "0.0", "va": "1.0", "ax": "0" }
            }
        }
        meas_data = {
            "savedPlan": plan,
            "periods": periods,
            "surgery_plan": {"od": {"sph": 0.0, "cyl": 0.0, "axis": 0}}
        }
        c.execute("INSERT INTO measurements (visit_id, data) VALUES (?, ?)", (v_id, json.dumps(meas_data)))

    conn.commit()
    conn.close()
    print(f"Successfully generated 25 CORRECT patients in {clinic_db_path}")

import os
if __name__ == "__main__":
    setup_test_clinic()
