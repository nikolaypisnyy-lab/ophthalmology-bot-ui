#!/bin/bash
export DATA_DIR="/root/medeye/data"
export API_DIR="/root/medeye/api"

echo "1. Cleaning rogue DBs..."
rm -vf $API_DIR/*.db

echo "2. Fixing permissions..."
chmod -R 777 $DATA_DIR
ls -la $DATA_DIR

echo "3. Verifying Table Names in clinic_test.db..."
sqlite3 $DATA_DIR/clinic_test.db ".tables"

echo "4. Checking MasterDB data (again, carefully)..."
sqlite3 $DATA_DIR/master.db "SELECT * FROM users_clinics;"

echo "5. Verifying api.py code content on server..."
grep "MasterDB" $API_DIR/api.py
