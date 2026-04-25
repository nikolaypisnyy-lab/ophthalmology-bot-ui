import sqlite3
import json
import os
from pathlib import Path

DB = "/root/medeye/data/clinic_c_9d238bbf.db"

def analyze():
    if not os.path.exists(DB):
        print("DB not found")
        return
        
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT data FROM measurements LIMIT 10").fetchall()
    
    for i, r in enumerate(rows):
        print(f"\n--- Patient {i} JSON keys ---")
        try:
            data = json.loads(r['data'])
            print(list(data.keys()))
            if 'periods' in data:
                print(f"Periods type: {type(data['periods'])}")
                print(f"Periods content: {data['periods']}")
            if 'surgery_plan' in data:
                print(f"Surgery Plan found")
        except Exception as e:
            print(f"Error parsing JSON: {e}")
    conn.close()

if __name__ == "__main__":
    analyze()
