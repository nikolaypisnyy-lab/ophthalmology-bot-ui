import sqlite3

DB_PATH = "/root/medeye/data/master.db"

def repair():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Сносим и создаем с правильными именами колонок (name вместо clinic_name)
    c.execute("DROP TABLE IF EXISTS users_clinics;")
    c.execute("DROP TABLE IF EXISTS clinics;")
    
    c.execute("""
    CREATE TABLE clinics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        db_file TEXT NOT NULL
    );
    """)
    c.execute("""
    CREATE TABLE users_clinics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        clinic_id TEXT NOT NULL,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
    );
    """)
    
    my_id = 379286602
    clinic_data = [
        ("c_9d238bbf", "DostarMed", "clinic_c_9d238bbf.db"),
        ("c_test", "Test Clinic", "clinic_test.db"),
        ("c_af854b86", "Lucy", "clinic_c_af854b86.db")
    ]
    
    for cid, name, dbf in clinic_data:
        c.execute("INSERT INTO clinics (id, name, db_file) VALUES (?, ?, ?)", (cid, name, dbf))
        c.execute("INSERT INTO users_clinics (user_id, clinic_id) VALUES (?, ?)", (my_id, cid))
    
    conn.commit()
    conn.close()
    print("Master DB RE-RE-CONSTRUCTED with correct column 'name'.")

if __name__ == "__main__":
    repair()
