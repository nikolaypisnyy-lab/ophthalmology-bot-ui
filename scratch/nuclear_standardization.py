import os
import re

FILES_TO_FIX = [
    "/root/medeye/api/api.py",
    "/root/medeye/api/master_db.py",
    "/root/medeye/api/bot_slim_v2.6.py",
    "/root/medeye/api/database.py"
]

def standardize():
    for filepath in FILES_TO_FIX:
        if not os.path.exists(filepath):
            print(f"Skipping {filepath} (not found)")
            continue
            
        with open(filepath, "r") as f:
            content = f.read()
            
        # Заменяем старые пути на новые
        new_content = content
        new_content = re.sub(r"/root/app/data/", "/root/medeye/data/", new_content)
        new_content = re.sub(r"/root/app/deploy/", "/root/medeye/api/", new_content)
        new_content = re.sub(r"/root/medeye_bot/", "/root/medeye/api/", new_content)
        
        # Специальное исправление для MasterDB в коде
        if "master_db = MasterDB()" in new_content:
            new_content = new_content.replace('master_db = MasterDB()', 'master_db = MasterDB("/root/medeye/data/master.db")')
            
        if new_content != content:
            with open(filepath, "w") as f:
                f.write(new_content)
            print(f"Standardized paths in {filepath}")
        else:
            print(f"No changes needed in {filepath}")

if __name__ == "__main__":
    standardize()
