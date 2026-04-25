#!/bin/bash
echo "=== LOG SCAN FOR NAMES ==="
journalctl -u medeye_bot.service --since "1 month ago" --no-pager | grep -iE "Alikhan|Denis|Alfiriev|Алихан|Денис|Алфирьев"

echo -e "\n=== SEARCHING ALL DBs FOR USERS ==="
find /root -name "*.db" -exec sh -c "echo '{}:' && sqlite3 '{}' 'SELECT telegram_id, name FROM users' 2>/dev/null" \;
