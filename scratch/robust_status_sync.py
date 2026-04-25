import sqlite3
import os
import json
from pathlib import Path

DATA_DIR = Path("/root/medeye/data")

def sync():
    for db_path in DATA_DIR.glob("clinic_*.db"):
        print(f"Syncing {db_path.name}...")
        try:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            
            # Проверяем таблицы
            tables = [t['name'] for t in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            if 'patients' not in tables or 'measurements' not in tables or 'visits' not in tables:
                continue

            # 1. Сначала соберем все визиты, которые явно "прооперированы"
            operated_visit_ids = []
            meas_rows = c.execute("SELECT visit_id, data FROM measurements").fetchall()
            for m in meas_rows:
                try:
                    data = json.loads(m['data'])
                    periods = data.get('periods', {})
                    if periods and any(periods.values()):
                        operated_visit_ids.append(str(m['visit_id']))
                except:
                    pass
            
            if not operated_visit_ids:
                print(f"  No operated visits found in {db_path.name}")
                continue
                
            print(f"  Found {len(operated_visit_ids)} operated visits. Updating patients...")
            
            # 2. Обновляем пациентов по этим визитам
            updated_count = 0
            for vid in operated_visit_ids:
                # Ищем пациента для этого визита
                # Пробуем и как строку, и как число
                v_row = c.execute("SELECT patient_id FROM visits WHERE visit_id = ? OR visit_id = ?", (vid, int(vid) if vid.isdigit() else -1)).fetchone()
                if v_row:
                    pid = v_row['patient_id']
                    c.execute("UPDATE patients SET status = 'done' WHERE patient_id = ?", (pid,))
                    updated_count += 1
            
            conn.commit()
            conn.close()
            print(f"  Done. Total patients marked as 'done': {updated_count}")
        except Exception as e:
            print(f"  Error in {db_path.name}: {e}")

if __name__ == "__main__":
    sync()
