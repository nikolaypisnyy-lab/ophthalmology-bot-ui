#!/bin/bash
for f in /root/medeye_bot/*.db; do
  echo "Checking $f ..."
  python3 -c "import sqlite3; conn=sqlite3.connect('$f'); print('Rows:', conn.execute('SELECT COUNT(*) FROM patients').fetchone())" 2>/dev/null || echo "No patients table"
done
