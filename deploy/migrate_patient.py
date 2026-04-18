import os
import sqlite3
import json
import sys

# Добавляем текущую папку в путь для импорта
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from master_db import master_db
from database import MedEyeDB

def migrate_patient(patient_id, from_clinic_id, to_clinic_id, delete_from_source=False):
    """
    Переносит все данные пациента из одной базы клиники в другую.
    """
    # 1. Получаем пути к базам
    cl_from = master_db.get_clinic_by_id(from_clinic_id)
    cl_to = master_db.get_clinic_by_id(to_clinic_id)
    
    if not cl_from or not cl_to:
        msg = f"[ERROR] Одна из клиник не найдена: {from_clinic_id} -> {to_clinic_id}"
        print(msg)
        return False, msg
    
    # 2. Инициализируем менеджеры БД
    db_from = MedEyeDB(cl_from["db_file"])
    db_to = MedEyeDB(cl_to["db_file"])
    
    # 3. Читаем данные из исходной базы
    p_row = db_from.get_patient(patient_id)
    if not p_row:
        msg = f"[ERROR] Пациент {patient_id} не найден в клинике {from_clinic_id}"
        print(msg)
        return False, msg
    
    # Собираем все данные пациента
    form = db_from.get_form(patient_id)
    
    # Все визиты пациента
    cursor_from = db_from.conn.cursor()
    visits = cursor_from.execute("SELECT * FROM visits WHERE patient_id = ?", (str(patient_id),)).fetchall()
    visits = [dict(v) for v in visits]
    vids = [v["visit_id"] for v in visits]
    
    # Все измерения для всех визитов
    meas_list = []
    if vids:
        placeholders = ', '.join(['?'] * len(vids))
        m_rows = cursor_from.execute(f"SELECT * FROM measurements WHERE visit_id IN ({placeholders})", vids).fetchall()
        meas_list = [dict(m) for m in m_rows]
    
    # Все записи Post-Op (Результаты)
    post_ops = cursor_from.execute("SELECT * FROM post_op WHERE patient_id = ?", (str(patient_id),)).fetchall()
    post_ops = [dict(po) for po in post_ops]

    # 4. Сохраняем в новую базу
    conn_to = db_to.conn
    cursor_to = conn_to.cursor()
    
    try:
        cursor_to.execute("BEGIN")
        
        # Пациент
        db_to.save_patient(p_row["patient_id"], p_row.get("chat_id"), p_row["name"], p_row["phone"], p_row["created_at"], p_row.get("archived", 0))
        
        # Форма (план операции)
        db_to.save_form(p_row["patient_id"], form.get("op_date"), form.get("op_time"), form.get("primary"))
        
        # Все Визиты
        for v in visits:
            db_to.save_visit(v["visit_id"], v["patient_id"], v["status"], v["active"], v["created_at"])
            
        # Все Измерения
        for m in meas_list:
            cursor_to.execute("INSERT OR REPLACE INTO measurements (visit_id, data) VALUES (?, ?)", (m["visit_id"], m["data"]))
            
        # Все Результаты (Post-Op)
        # Очищаем старые если были (чтобы не дублировать)
        cursor_to.execute("DELETE FROM post_op WHERE patient_id = ?", (str(patient_id),))
        for po in post_ops:
            cursor_to.execute(
                "INSERT INTO post_op (patient_id, date, period, summary, notes, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (str(patient_id), po["date"], po["period"], po["summary"], po["notes"], po["data"], po["created_at"])
            )
            
        cursor_to.execute("COMMIT")
        
        if delete_from_source:
            db_from.delete_patient(patient_id)
            
        msg = f"Пациент {p_row['name']} ({patient_id}) полностью перенесен в {cl_to['name']} (визитов: {len(visits)}, результатов: {len(post_ops)})"
        print(f"[SUCCESS] {msg}")
        return True, msg
        
    except Exception as e:
        try: cursor_to.execute("ROLLBACK")
        except: pass
        msg = f"Ошибка миграции: {e}"
        print(f"[ERROR] {msg}")
        return False, msg
        
    except Exception as e:
        conn_to.rollback()
        msg = f"Ошибка миграции: {e}"
        print(f"[ERROR] {msg}")
        return False, msg

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Использование: python migrate_patient.py <PATIENT_ID> <FROM_CLINIC_ID> <TO_CLINIC_ID>")
    else:
        migrate_patient(sys.argv[1], sys.argv[2], sys.argv[3])
