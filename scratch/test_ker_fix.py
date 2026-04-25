import json
import sqlite3
import os

# Имитируем логику API и БД
def save_meas_mock(conn, vid, data):
    # Логика мерджа как в api.py
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM measurements WHERE visit_id = ?", (vid,))
    row = cursor.fetchone()
    current = json.loads(row[0]) if row and row[0] else {}
    
    # Мерджим
    for k, v in data.items():
        if isinstance(v, dict) and isinstance(current.get(k), dict):
            current[k].update(v)
        else:
            current[k] = v
            
    # Сохраняем
    cursor.execute("INSERT OR REPLACE INTO measurements (visit_id, data) VALUES (?, ?)", (vid, json.dumps(current)))
    conn.commit()

# --- ТЕСТ ---
db_file = "test_ker_fix.db"
if os.path.exists(db_file): os.remove(db_file)

conn = sqlite3.connect(db_file)
conn.execute("CREATE TABLE measurements (visit_id TEXT PRIMARY KEY, data TEXT)")

vid = "V-TEST-01"
# 1. Представим, что в базе уже есть какие-то данные
conn.execute("INSERT INTO measurements VALUES (?, ?)", (vid, json.dumps({"existing": "data"})))

# 2. Имитируем ПЕРВЫЙ запрос от фронта (Ker Cyl/Ax) во вкладке Plan
# Как мы выяснили, фронт теперь шлет Ker Cyl/Ax в блок autoref_narrow
# и в блок keratometry для совместимости.
payload = {
    "autoref_narrow": {
        "od": {"kercyl": -1.25, "kerax": 175}
    },
    "keratometry": {
        "od": {"axis": 175, "k1": 43.5}
    }
}

print(f"🚀 Сохраняем данные: {json.dumps(payload)}")
save_meas_mock(conn, vid, payload)

# 3. Проверяем, что в базе
cursor = conn.cursor()
cursor.execute("SELECT data FROM measurements WHERE visit_id = ?", (vid,))
saved_data = json.loads(cursor.fetchone()[0])
print(f"✅ В базе теперь лежит: {json.dumps(saved_data, indent=2)}")

# 4. Проверяем "всеядность" чтения (как в mapEyeData)
def map_test(m):
    eye = {}
    # Читаем из narrow
    nar = m.get('autoref_narrow', {}).get('od', {})
    eye['kercyl'] = nar.get('kercyl')
    eye['kerax'] = nar.get('kerax')
    
    # Читаем из keratometry (дополняем/уточняем)
    ker = m.get('keratometry', {}).get('od', {})
    if ker:
        eye['kercyl'] = ker.get('kercyl', eye.get('kercyl'))
        # Вот тут была собака зарыта: если в ker лежит 'axis', а мы ищем 'kerax' - мы теряли данные
        eye['kerax'] = ker.get('axis', ker.get('kerax', eye.get('kerax')))
    return eye

mapped = map_test(saved_data)
print(f"🔍 Результат маппинга для UI: {mapped}")

if mapped['kercyl'] == -1.25 and mapped['kerax'] == 175:
    print("\n🔥🔥🔥 ТЕСТ ПРОЙДЕН: Данные сохранены и считаны корректно!")
else:
    print("\n❌ ТЕСТ ПРОВАЛЕН: Данные потеряны.")

conn.close()
os.remove(db_file)
