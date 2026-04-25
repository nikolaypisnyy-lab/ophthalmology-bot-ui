import os
import re

DB_PATH = "/root/medeye/api/database.py"

def upgrade():
    with open(DB_PATH, "r") as f:
        content = f.read()

    # 1. Обновляем CREATE TABLE для patients
    content = content.replace(
        "archived INTEGER DEFAULT 0",
        "archived INTEGER DEFAULT 0,\n                status TEXT DEFAULT 'planned'"
    )

    # 2. Переписываем get_all_patients на "умный" поиск
    smart_get_all = """    def get_all_patients(self):
        # Умный запрос: соединяем пациентов с данными об их операциях (results)
        rows = self.execute(\"\"\"
            SELECT p.*, m.data as meas_data
            FROM patients p
            LEFT JOIN visits v ON p.patient_id = v.patient_id
            LEFT JOIN measurements m ON v.visit_id = m.visit_id
            ORDER BY p.created_at DESC
        \"\"\").fetchall()
        
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
        return res"""
    
    # Заменяем старый метод get_all_patients
    pattern = re.compile(r"def get_all_patients\(self\):.*?return \[dict\(r\) for r in rows\]", re.DOTALL)
    content = pattern.sub(smart_get_all, content)

    # 3. Аналогично для get_patient (одиночный просмотр)
    smart_get_one = """    def get_patient(self, pid):
        row = self.execute(\"\"\"
            SELECT p.*, m.data as meas_data
            FROM patients p
            LEFT JOIN visits v ON p.patient_id = v.patient_id
            LEFT JOIN measurements m ON v.visit_id = m.visit_id
            WHERE p.patient_id = ?
        \"\"\", (str(pid),)).fetchone()
        if not row: return None
        d = dict(row)
        if d.get('status') != 'done' and d.get('meas_data'):
            try:
                meas = json.loads(d['meas_data'])
                if meas.get('periods') and any(meas['periods'].values()):
                    d['status'] = 'done'
            except: pass
        d.pop('meas_data', None)
        return d"""

    pattern_one = re.compile(r"def get_patient\(self, pid\):.*?return dict\(row\) if row else None", re.DOTALL)
    content = pattern_one.sub(smart_get_one, content)

    with open(DB_PATH, "w") as f:
        f.write(content)
    print("Database core upgraded globally.")

if __name__ == "__main__":
    upgrade()
