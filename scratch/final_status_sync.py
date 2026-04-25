import sqlite3
import os
import json
from pathlib import Path

DATA_DIR = Path("/root/medeye/data")

def sync():
    for db_path in DATA_DIR.glob("clinic_*.db"):
        print(f"Syncing {db_path.name}...")
        try:
            # Используем Row factory чтобы обращаться по именам колонок
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            
            # Проверяем наличие нужных таблиц
            tables = [t['name'] for t in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            if 'patients' not in tables or 'measurements' not in tables or 'visits' not in tables:
                print(f"  Skipping {db_path.name} (missing tables)")
                continue

            # Находим всех пациентов, у которых есть данные об операциях
            # Джоиним пациентов с их визитами и измерениями
            query = """
                SELECT p.patient_id, m.data 
                FROM patients p
                JOIN visits v ON p.patient_id = v.patient_id
                JOIN measurements m ON v.visit_id = m.visit_id
            """
            rows = c.execute(query).fetchall()
            
            updated_count = 0
            for r in rows:
                pid = r['patient_id']
                try:
                    data = json.loads(r['data'])
                    periods = data.get('periods', {})
                    
                    # Если есть хоть один заполненный период
                    if periods and any(periods.values()):
                        c.execute("UPDATE patients SET status = 'done' WHERE patient_id = ?", (pid,))
                        updated_count += 1
                except:
                    pass
            
            conn.commit()
            conn.close()
            print(f"  Successfully updated {updated_count} patients.")
        except Exception as e:
            print(f"  Error in {db_path.name}: {e}")

if __name__ == "__main__":
    sync()
