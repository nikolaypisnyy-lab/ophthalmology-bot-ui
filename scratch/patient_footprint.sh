#!/bin/bash
echo "=== SEARCHING FOR AUTHOR IDs IN PATIENT RECORDS ==="
for db in /root/medeye/data/clinic_*.db; do
  echo "Checking $db..."
  # Ищем любые колонки с упоминанием автора или врача
  sqlite3 "$db" "PRAGMA table_info(patients)" | grep -iE "author|doctor|user|created"
  sqlite3 "$db" "SELECT DISTINCT author_id FROM patients 2>/dev/null"
  sqlite3 "$db" "SELECT DISTINCT doctor_id FROM patients 2>/dev/null"
done
