import sqlite3
import os
import json
from pathlib import Path

DATA_DIR = Path("/root/medeye/data")

def fix_schema_and_sync():
    for db_path in DATA_DIR.glob("clinic_*.db"):
        print(f"Fixing schema in {db_path.name}...")
        try:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            
            # 1. Проверяем таблицу patients
            tables = [t['name'] for t in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            if 'patients' not in tables:
                continue
                
            # Проверяем колонку status
            columns = [col['name'] for col in c.execute("PRAGMA table_info(patients)")]
            if 'status' not in columns:
                print(f"  Adding 'status' column to {db_path.name}...")
                c.execute("ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'planned'")
            
            # 2. Теперь синхронизируем статусы
            if 'measurements' in tables and 'visits' in tables:
                query = """
                    SELECT p.patient_id, m.data 
                    FROM patients p
                    JOIN visits v ON p.patient_id = v.patient_id
                    JOIN measurements m ON v.visit_id = m.visit_id
                """
                rows = c.execute(query).fetchall()
                updated = 0
                for r in rows:
                    try:
                        data = json.loads(r['data'])
                        if data.get('periods') and any(data['periods'].values()):
                            c.execute("UPDATE patients SET status = 'done' WHERE patient_id = ?", (r['patient_id'],))
                            updated += 1
                    except: pass
                print(f"  Updated {updated} statuses.")

            conn.commit()
            conn.close()
        except Exception as e:
            print(f"  Error in {db_path.name}: {e}")

if __name__ == "__main__":
    fix_schema_and_sync()
