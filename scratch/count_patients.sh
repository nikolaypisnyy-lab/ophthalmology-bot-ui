#!/bin/bash
ssh root@92.38.48.231 "python3 -c \"import sqlite3; conn=sqlite3.connect('/root/medeye_bot/clinic_c_b4eebd36.db'); print(conn.execute('SELECT COUNT(*) FROM patients').fetchone())\""
