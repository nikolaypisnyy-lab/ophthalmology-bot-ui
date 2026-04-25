import sqlite3, os, shutil

def merge_dbs(target_path, uploaded_path):
    conn = sqlite3.connect(target_path)
    cursor = conn.cursor()
    try:
        cursor.execute(f"ATTACH DATABASE '{uploaded_path}' AS uploaded")
        # Переносим пациентов и измерения
        cursor.execute("INSERT OR IGNORE INTO patients SELECT * FROM uploaded.patients")
        cursor.execute("INSERT OR IGNORE INTO measurements SELECT * FROM uploaded.measurements")
        conn.commit()
        return True
    except Exception as e:
        print(f'Merge error: {e}')
        return False
    finally:
        conn.close()

