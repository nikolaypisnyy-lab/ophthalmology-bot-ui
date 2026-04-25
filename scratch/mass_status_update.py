import sqlite3
import os
from pathlib import Path
import json

DATA_DIR = Path("/root/medeye/data")

def update_statuses():
    for db_path in DATA_DIR.glob("clinic_*.db"):
        print(f"Updating statuses in {db_path.name}...")
        try:
            conn = sqlite3.connect(str(db_path))
            c = conn.cursor()
            
            # 1. Получаем всех пациентов
            patients = c.execute("SELECT patient_id FROM patients").fetchall()
            
            for (pid,) in patients:
                # 2. Проверяем, есть ли у пациента периоды (постоп осмотры) в таблице measurements
                # Обычно периоды хранятся в json в колонке 'periods'
                has_surgery = False
                
                # Ищем visit_id для этого пациента
                visit = c.execute("SELECT visit_id FROM visits WHERE patient_id = ?", (pid,)).fetchone()
                if visit:
                    vid = visit[0]
                    measurements = c.execute("SELECT periods FROM measurements WHERE visit_id = ?", (vid,)).fetchone()
                    if measurements and measurements[0]:
                        try:
                            periods = json.loads(measurements[0])
                            if any(periods.values()): # Если в словаре периодов есть хоть что-то
                                has_surgery = True
                        except:
                            pass
                
                if has_surgery:
                    c.execute("UPDATE patients SET status = 'done' WHERE patient_id = ?", (pid,))
                    print(f"  Patient {pid}: status -> done")
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"  Error updating {db_path.name}: {e}")

if __name__ == "__main__":
    update_statuses()
