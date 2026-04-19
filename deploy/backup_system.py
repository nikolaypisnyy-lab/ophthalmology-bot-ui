import os
import shutil
import datetime
import sqlite3
from pathlib import Path

# Конфигурация
DATA_DIR = Path("/root/app/data")
BACKUP_DIR = Path("/root/app/backups")
KEEP_DAYS = 7

def create_backup():
    if not DATA_DIR.exists():
        # Режим локальной разработки
        local_data = Path("./deploy")
        if local_data.exists():
            data_path = local_data
            backup_path = Path("./backups")
        else:
            print("Data directory not found.")
            return
    else:
        data_path = DATA_DIR
        backup_path = BACKUP_DIR

    backup_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    daily_folder = backup_path / timestamp
    daily_folder.mkdir(exist_ok=True)
    
    db_files = list(data_path.glob("*.db"))
    if not db_files:
        print("No databases to backup.")
        return
        
    for db in db_files:
        shutil.copy2(db, daily_folder / db.name)
        print(f"Backed up: {db.name}")
        
    print(f"Backup created at {daily_folder}")
    cleanup_old_backups(backup_path)

def cleanup_old_backups(backup_path):
    now = datetime.datetime.now()
    backups = sorted(backup_path.iterdir(), key=os.path.getmtime)
    
    for b in backups:
        if not b.is_dir(): continue
        # Пытаемся распарсить дату из названия папки (YYYYMMDD_HHMMSS)
        try:
            folder_date = datetime.datetime.strptime(b.name, "%Y%m%d_%H%M%S")
            if (now - folder_date).days > KEEP_DAYS:
                shutil.rmtree(b)
                print(f"Removed old backup: {b.name}")
        except:
            pass

def list_backups():
    backup_path = BACKUP_DIR if BACKUP_DIR.exists() else Path("./backups")
    if not backup_path.exists():
        print("No backups folder.")
        return []
        
    folders = sorted([f for f in backup_path.iterdir() if f.is_dir()], key=os.path.getmtime, reverse=True)
    for i, f in enumerate(folders):
        print(f"[{i}] {f.name}")
    return folders

def restore_backup(index):
    folders = list_backups()
    if not folders or index >= len(folders):
        print("Invalid index.")
        return
        
    target_folder = folders[index]
    data_path = DATA_DIR if DATA_DIR.exists() else Path("./deploy")
    
    print(f"RESTORING FROM {target_folder.name}...")
    
    for db in target_folder.glob("*.db"):
        shutil.copy2(db, data_path / db.name)
        print(f"Restored: {db.name}")
    
    print("Restore complete. Please restart services.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "create": create_backup()
        elif cmd == "list": list_backups()
        elif cmd == "restore" and len(sys.argv) > 2:
            restore_backup(int(sys.argv[2]))
    else:
        print("Usage: python3 backup_system.py [create|list|restore <index>]")
