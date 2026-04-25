import sqlite3
import json
import random

db_path = "/root/medeye/data/clinic_test.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Получаем все измерения
cur.execute("SELECT visit_id, data FROM measurements")
rows = cur.fetchall()

updated_count = 0
for vid, data_json in rows:
    try:
        data = json.loads(data_json)
        periods = data.get("periods", {})
        if not periods:
            continue
            
        # Ищем самый свежий период
        best_pk = None
        for pk in ["1y", "6m", "3m", "1m", "1w", "1d"]:
            if pk in periods:
                best_pk = pk
                break
        
        if not best_pk:
            continue
            
        # Добавляем ошибку по цилиндру (-0.25, -0.50 или -0.75)
        error = random.choice([-0.25, -0.5, -0.5, -0.75])
        
        changed = False
        for eye in ["od", "os"]:
            if eye in periods[best_pk]:
                curr_cyl = float(periods[best_pk][eye].get("cyl") or 0)
                periods[best_pk][eye]["cyl"] = round(curr_cyl + error, 2)
                changed = True
        
        if changed:
            data["periods"] = periods
            cur.execute("UPDATE measurements SET data = ? WHERE visit_id = ?", (json.dumps(data), vid))
            updated_count += 1
            
    except Exception as e:
        print(f"Error updating {vid}: {e}")

conn.commit()
conn.close()
print(f"Successfully injected cylinder errors into {updated_count} records.")
