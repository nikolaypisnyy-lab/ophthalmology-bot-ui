import sqlite3
import os
import glob

def audit_db(path):
    try:
        conn = sqlite3.connect(path)
        c = conn.cursor()
        c.execute("SELECT count(*) FROM patients")
        p_count = c.fetchone()[0]
        try:
            c.execute("SELECT count(*) FROM examinations")
            e_count = c.fetchone()[0]
        except:
            e_count = "N/A (No table)"
        conn.close()
        return f"Patients: {p_count}, Exams: {e_count}"
    except Exception as e:
        return f"Error: {e}"

paths = glob.glob("/root/app/data/*.db") + glob.glob("/root/medeye_bot/*.db")
for p in set(paths):
    print(f"{p}: {audit_db(p)}")
