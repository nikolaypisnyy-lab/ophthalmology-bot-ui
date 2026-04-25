import sqlite3
import json
import threading
import os

# Пути к базам данных всегда относительно папки со скриптом
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class MedEyeDB:
    def __init__(self, db_path="medeye.db"):
        # На сервере данные лежат в отдельной папке для сохранности при деплое
        DATA_DIR = "/root/medeye/data"
        
        # Если передан только флаг/имя файла, делаем его абсолютным
        if not os.path.isabs(db_path):
            if os.path.exists(DATA_DIR):
                self.db_path = os.path.join(DATA_DIR, db_path)
            else:
                self.db_path = os.path.join(BASE_DIR, db_path)
        else:
            self.db_path = db_path
            
        self._local = threading.local()
        self._init_db()

    @property
    def conn(self):
        if not hasattr(self._local, "conn"):
            # Создаем папку если ее нет
            db_dir = os.path.dirname(self.db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)
                
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
            CREATE TABLE IF NOT EXISTS patients (
                patient_id TEXT PRIMARY KEY,
                chat_id INTEGER,
                name TEXT,
                phone TEXT,
                created_at TEXT,
                archived INTEGER DEFAULT 0,
                status TEXT DEFAULT 'planned',
                flapDiam TEXT,
                capOrFlap TEXT,
                isCustomView INTEGER DEFAULT 0,
                isCustomViewOD INTEGER DEFAULT 0,
                isCustomViewOS INTEGER DEFAULT 0
            )
        """, commit=True)
        # Миграция
        try:
            self.execute("ALTER TABLE patients ADD COLUMN flapDiam TEXT", commit=True)
        except: pass
        try:
            self.execute("ALTER TABLE patients ADD COLUMN capOrFlap TEXT", commit=True)
        except: pass
        try:
            self.execute("ALTER TABLE patients ADD COLUMN isCustomView INTEGER DEFAULT 0", commit=True)
        except: pass
        try:
            self.execute("ALTER TABLE patients ADD COLUMN isCustomViewOD INTEGER DEFAULT 0", commit=True)
        except: pass
        try:
            self.execute("ALTER TABLE patients ADD COLUMN isCustomViewOS INTEGER DEFAULT 0", commit=True)
        except: pass

        self.execute("CREATE TABLE IF NOT EXISTS forms (patient_id TEXT PRIMARY KEY, op_date TEXT, op_time TEXT, primary_data TEXT)", commit=True)
        self.execute("CREATE TABLE IF NOT EXISTS visits (visit_id TEXT PRIMARY KEY, patient_id TEXT, status TEXT, active INTEGER, created_at TEXT)", commit=True)
        self.execute("CREATE TABLE IF NOT EXISTS measurements (visit_id TEXT PRIMARY KEY, data TEXT)", commit=True)
        self.execute("CREATE TABLE IF NOT EXISTS post_op (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT, date TEXT, period TEXT, summary TEXT, notes TEXT, data TEXT, created_at TEXT)", commit=True)
        self.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, role TEXT)", commit=True)
        self.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)", commit=True)

    # --- Patients ---
    def get_all_patients(self):
        # Умный запрос: соединяем пациентов с данными об их операциях (results)
        rows = self.execute("""
            SELECT p.*, m.data as meas_data
            FROM patients p
            LEFT JOIN visits v ON p.patient_id = v.patient_id
            LEFT JOIN measurements m ON v.visit_id = m.visit_id
            ORDER BY p.created_at DESC
        """).fetchall()
        
        res = []
        for r in rows:
            d = dict(r)
            # Если в базе статус не done, но в measurements есть периоды (осмотры) - считаем 'done'
            if d.get('status') != 'done' and d.get('meas_data'):
                try:
                    meas = json.loads(d['meas_data'])
                    periods = meas.get('periods', {})
                    if periods and any(periods.values()):
                        d['status'] = 'done'
                except:
                    pass
            d.pop('meas_data', None) # Удаляем сырые данные из ответа списка
            res.append(d)
        return res

    def get_patient(self, pid):
        row = self.execute("""
            SELECT p.*, m.data as meas_data
            FROM patients p
            LEFT JOIN visits v ON p.patient_id = v.patient_id
            LEFT JOIN measurements m ON v.visit_id = m.visit_id
            WHERE p.patient_id = ?
        """, (str(pid),)).fetchone()
        if not row: return None
        d = dict(row)
        if d.get('status') != 'done' and d.get('meas_data'):
            try:
                meas = json.loads(d['meas_data'])
                if meas.get('periods') and any(meas['periods'].values()):
                    d['status'] = 'done'
            except: pass
        d.pop('meas_data', None)
        return d
        
    def find_patient_by_chat(self, chat_id):
        row = self.execute("SELECT * FROM patients WHERE chat_id = ?", (chat_id,)).fetchone()
        return dict(row) if row else None

    def save_patient(self, pid, chat_id, name, phone, created_at, archived=0, flapDiam=None, capOrFlap=None, isCustomView=0, isCustomViewOD=0, isCustomViewOS=0):
        self.execute(
            "INSERT OR REPLACE INTO patients (patient_id, chat_id, name, phone, created_at, archived, flapDiam, capOrFlap, isCustomView, isCustomViewOD, isCustomViewOS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (str(pid), chat_id, name, phone, created_at, archived, flapDiam, capOrFlap, isCustomView, isCustomViewOD, isCustomViewOS),
            commit=True
        )

    def delete_patient(self, pid):
        self.execute("DELETE FROM patients WHERE patient_id = ?", (str(pid),), commit=True)
        self.execute("DELETE FROM forms WHERE patient_id = ?", (str(pid),), commit=True)
        self.execute("DELETE FROM measurements WHERE visit_id IN (SELECT visit_id FROM visits WHERE patient_id = ?)", (str(pid),), commit=True)
        self.execute("DELETE FROM visits WHERE patient_id = ?", (str(pid),), commit=True)
        self.execute("DELETE FROM post_op WHERE patient_id = ?", (str(pid),), commit=True)

    # --- Forms (Опросы и Планы) ---
    def get_all_forms(self):
        rows = self.execute("SELECT * FROM forms").fetchall()
        res = {}
        for r in rows:
            res[str(r['patient_id'])] = {
                "op_date": r["op_date"],
                "op_time": r["op_time"],
                "primary": json.loads(r["primary_data"]) if r["primary_data"] else {}
            }
        return res

    def get_form(self, pid):
        row = self.execute("SELECT * FROM forms WHERE patient_id = ?", (str(pid),)).fetchone()
        if row:
            return {
                "op_date": row["op_date"],
                "op_time": row["op_time"],
                "primary": json.loads(row["primary_data"]) if row["primary_data"] else {}
            }
        return {"op_date": None, "op_time": None, "primary": {}}

    def save_form(self, pid, op_date=None, op_time=None, primary=None):
        current = self.get_form(pid)
        new_date = op_date if op_date is not None else current.get('op_date')
        new_time = op_time if op_time is not None else current.get('op_time')
        new_prim = primary if primary is not None else current.get('primary', {})
        
        self.execute(
            "INSERT OR REPLACE INTO forms (patient_id, op_date, op_time, primary_data) VALUES (?, ?, ?, ?)",
            (str(pid), new_date, new_time, json.dumps(new_prim, ensure_ascii=False)),
            commit=True
        )

    # --- Visits ---
    def get_all_visits(self):
        rows = self.execute("SELECT * FROM visits").fetchall()
        return {str(r['patient_id']): dict(r) for r in rows}

    def get_visit(self, pid):
        # Важно: выбираем визит, где уже есть сохраненные измерения.
        # Иначе в UI может прийти visit_id без данных, и форма останется пустой.
        row = self.execute(
            """
            SELECT v.*
            FROM visits v
            LEFT JOIN measurements m ON m.visit_id = v.visit_id
            WHERE v.patient_id = ?
            ORDER BY
                CASE WHEN m.data IS NOT NULL AND m.data != '' THEN 0 ELSE 1 END,
                v.created_at DESC
            LIMIT 1
            """,
            (str(pid),)
        ).fetchone()
        if row:
            d = dict(row)
            d['active'] = bool(d['active'])
            return d
        return None

    def save_visit(self, vid, pid, status, active, created_at):
        self.execute(
            "INSERT OR REPLACE INTO visits (visit_id, patient_id, status, active, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(vid), str(pid), status, int(active), created_at),
            commit=True
        )

    # --- Measurements ---
    def get_all_meas(self):
        rows = self.execute("SELECT * FROM measurements").fetchall()
        return {str(r['visit_id']): json.loads(r['data']) for r in rows}

    def get_meas(self, vid):
        row = self.execute("SELECT data FROM measurements WHERE visit_id = ?", (str(vid),)).fetchone()
        if row and row['data']:
            return json.loads(row['data'])
        return {}

    def save_meas(self, vid, data):
        self.execute(
            "INSERT OR REPLACE INTO measurements (visit_id, data) VALUES (?, ?)",
            (str(vid), json.dumps(data, ensure_ascii=False)),
            commit=True
        )

    # --- Meta & Users ---
    def get_next_patient_id(self):
        row = self.execute("SELECT value FROM meta WHERE key = 'next_patient_id'").fetchone()
        return int(row['value']) if row else 1

    def set_next_patient_id(self, new_val):
        self.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('next_patient_id', ?)", (str(new_val),), commit=True)
        
    def get_users(self):
        rows = self.execute("SELECT * FROM users").fetchall()
        return {str(r['user_id']): r['role'] for r in rows}
        
    def save_user(self, uid, role):
        self.execute("INSERT OR REPLACE INTO users (user_id, role) VALUES (?, ?)", (str(uid), role), commit=True)
        
    def delete_user(self, uid):
        self.execute("DELETE FROM users WHERE user_id = ?", (str(uid),), commit=True)

    # --- Post-Op ---
    def get_all_post_op(self):
        rows = self.execute("SELECT * FROM post_op ORDER BY date ASC").fetchall()
        res = {}
        for r in rows:
            pid = str(r['patient_id'])
            if pid not in res:
                res[pid] = []
            res[pid].append({
                "date": r["date"],
                "period": r["period"],
                "summary": r["summary"],
                "notes": r["notes"],
                "created_at": r["created_at"],
                "data": json.loads(r["data"]) if r["data"] else {}
            })
        return res

    # --- Fast Bulk Sync (Bridge for migration) ---
    def bulk_sync(self, db_dict, post_op_dict):
        cursor = self.conn.cursor()
        try:
            cursor.execute("BEGIN TRANSACTION")
            cursor.executemany(
                "INSERT OR REPLACE INTO patients (patient_id, chat_id, name, phone, created_at, archived) VALUES (?, ?, ?, ?, ?, ?)",
                [(str(p.get("patient_id")), p.get("chat_id"), p.get("name"), p.get("phone"), p.get("created_at"), 1 if p.get("archived") else 0) for p in db_dict.get("patients", [])]
            )
            cursor.executemany(
                "INSERT OR REPLACE INTO forms (patient_id, op_date, op_time, primary_data) VALUES (?, ?, ?, ?)",
                [(str(pid), f.get("op_date"), f.get("op_time"), json.dumps(f.get("primary", {}), ensure_ascii=False)) for pid, f in db_dict.get("forms", {}).items()]
            )
            cursor.executemany(
                "INSERT OR REPLACE INTO visits (visit_id, patient_id, status, active, created_at) VALUES (?, ?, ?, ?, ?)",
                [(str(v["visit_id"]), str(pid), v.get("status"), 1 if v.get("active") else 0, v.get("created_at")) for pid, v in db_dict.get("visits", {}).items()]
            )
            cursor.executemany(
                "INSERT OR REPLACE INTO measurements (visit_id, data) VALUES (?, ?)",
                [(str(vid), json.dumps(m, ensure_ascii=False)) for vid, m in db_dict.get("meas", {}).items()]
            )
            cursor.executemany(
                "INSERT OR REPLACE INTO users (user_id, role) VALUES (?, ?)",
                [(str(uid), str(role)) for uid, role in db_dict.get("users", {}).items()]
            )
            nxt = db_dict.get("meta", {}).get("next_patient_id", 1)
            cursor.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('next_patient_id', ?)", (str(nxt),))
            
            cursor.execute("DELETE FROM post_op")
            po_rows = [(str(pid), e.get("date"), e.get("period"), e.get("summary"), e.get("notes"), json.dumps(e.get("data", {}), ensure_ascii=False), e.get("created_at")) for pid, entries in post_op_dict.items() for e in entries]
            cursor.executemany("INSERT INTO post_op (patient_id, date, period, summary, notes, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", po_rows)
            
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] Bulk sync failed: {e}")
            raise

# Экземпляр для импорта в другие файлы
db_manager = MedEyeDB()