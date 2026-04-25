import sqlite3
import threading
import uuid
import datetime

import os

# Путь к мастер-базе
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = "/root/medeye/data"

if os.path.exists(DATA_DIR):
    DEFAULT_DB_PATH = os.path.join(DATA_DIR, "master.db")
else:
    DEFAULT_DB_PATH = os.path.join(BASE_DIR, "master.db")

class MasterDB:
    def __init__(self, db_path=DEFAULT_DB_PATH):
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()

    @property
    def conn(self):
        if not hasattr(self._local, "conn"):
            self._local.conn = sqlite3.connect(self.db_path)
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def execute(self, query, params=(), commit=False):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        if commit:
            self.conn.commit()
        return cursor

    def _init_db(self):
        self.execute("""
            CREATE TABLE IF NOT EXISTS clinics (
                clinic_id TEXT PRIMARY KEY,
                name TEXT,
                db_file TEXT,
                created_at TEXT
            )
        """, commit=True)
        self.execute("""
            CREATE TABLE IF NOT EXISTS users (
                telegram_id INTEGER,
                clinic_id TEXT,
                role TEXT,
                name TEXT,
                PRIMARY KEY (telegram_id, clinic_id)
            )
        """, commit=True)

    def create_clinic(self, name: str, clinic_id: str = None) -> str:
        cid = clinic_id if clinic_id else "c_" + str(uuid.uuid4())[:8]
        db_file = f"clinic_{cid}.db"
        self.execute(
            "INSERT OR REPLACE INTO clinics (clinic_id, name, db_file, created_at) VALUES (?, ?, ?, ?)",
            (cid, name, db_file, datetime.datetime.now().isoformat()),
            commit=True
        )
        return cid

    def get_all_clinics(self) -> list:
        rows = self.execute("SELECT * FROM clinics").fetchall()
        return [dict(r) for r in rows]

    def get_clinic_by_id(self, cid: str) -> dict:
        row = self.execute("SELECT * FROM clinics WHERE clinic_id = ?", (cid,)).fetchone()
        return dict(row) if row else None
        
    def rename_clinic(self, cid: str, new_name: str):
        self.execute("UPDATE clinics SET name = ? WHERE clinic_id = ?", (new_name, cid), commit=True)
        
    def delete_clinic(self, cid: str) -> str:
        row = self.execute("SELECT db_file FROM clinics WHERE clinic_id = ?", (cid,)).fetchone()
        if not row: return ""
        db_file = row["db_file"]
        self.execute("DELETE FROM users WHERE clinic_id = ?", (cid,))
        self.execute("DELETE FROM clinics WHERE clinic_id = ?", (cid,), commit=True)
        return db_file

    def add_user(self, user_id: int, clinic_id: str, role: str, name: str = ""):
        self.execute(
            "INSERT OR REPLACE INTO users (telegram_id, clinic_id, role, name) VALUES (?, ?, ?, ?)",
            (user_id, clinic_id, role, name),
            commit=True
        )

    def get_user_clinic(self, user_id: int, clinic_id: str = None) -> dict:
        query = """
            SELECT u.*, c.name as clinic_name, c.db_file 
            FROM users u
            JOIN clinics c ON u.clinic_id = c.clinic_id
            WHERE u.telegram_id = ?
        """
        if clinic_id:
            row = self.execute(query + " AND u.clinic_id = ?", (user_id, clinic_id)).fetchone()
        else:
            row = self.execute(query, (user_id,)).fetchone()
        
        return dict(row) if row else None

    def get_user_clinics(self, user_id: int) -> list:
        rows = self.execute("""
            SELECT u.*, c.name as clinic_name, c.db_file 
            FROM users u
            JOIN clinics c ON u.clinic_id = c.clinic_id
            WHERE u.telegram_id = ?
        """, (user_id,)).fetchall()
        return [dict(r) for r in rows]

    def get_all_users(self) -> list:
        rows = self.execute("""
            SELECT u.*, c.name as clinic_name 
            FROM users u
            JOIN clinics c ON u.clinic_id = c.clinic_id
            ORDER BY c.name, u.name
        """).fetchall()
        return [dict(r) for r in rows]

    def delete_user_access(self, user_id: int, clinic_id: str):
        self.execute(
            "DELETE FROM users WHERE telegram_id = ? AND clinic_id = ?",
            (user_id, clinic_id),
            commit=True
        )

master_db = MasterDB(DEFAULT_DB_PATH)