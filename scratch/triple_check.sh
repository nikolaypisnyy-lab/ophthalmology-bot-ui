#!/bin/bash
export DB_DIR="/root/medeye/data"

echo "=== 1. CLINIC MAPPING CHECK (master.db) ==="
sqlite3 $DB_DIR/master.db "SELECT u.user_id, c.clinic_name, c.db_file FROM users_clinics u JOIN clinics c ON u.clinic_id = c.id;"

echo -e "\n=== 2. PATIENT COUNT PER CLINIC ==="
for db in $DB_DIR/clinic_*.db; do
    count=$(sqlite3 "$db" "SELECT COUNT(*) FROM patients;" 2>/dev/null || echo "ERROR")
    echo "DB: $(basename $db) -> Patients: $count"
done

echo -e "\n=== 3. LIVE API TEST (Patients list) ==="
# DostarMed (c_9d238bbf)
curl -s -H "telegram-id: 379286602" -H "clinic-id: c_9d238bbf" http://127.0.0.1:8000/api/patients | python3 -c "import sys,json; d=json.load(sys.stdin); print('API DostarMed Patients:', len(d.get('patients', [])))"
# Test Clinic (c_test)
curl -s -H "telegram-id: 379286602" -H "clinic-id: c_test" http://127.0.0.1:8000/api/patients | python3 -c "import sys,json; d=json.load(sys.stdin); print('API Test Clinic Patients:', len(d.get('patients', [])))"

echo -e "\n=== 4. ORPHAN FILES SEARCH (Should be empty) ==="
ls -R /root/app /root/medeye_bot 2>/dev/null || echo "Old folders are empty/gone."
ls /root/medeye/api/*.db 2>/dev/null || echo "No rogue DBs in api folder."
