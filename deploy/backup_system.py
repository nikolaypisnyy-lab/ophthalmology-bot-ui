import os
import shutil
import datetime
import sqlite3
from pathlib import Path

# Конфигурация
DATA_DIR = Path("/root/medeye/data")
BACKUP_DIR = Path("/root/medeye/backups")
KEEP_COUNT = 2

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

def create_code_snapshot():
    # На сервере код лежит в /root/medeye/api
    if not Path("/root/medeye/api").exists():
        print("Not on server, skipping code snapshot.")
        return
        
    SNAPSHOT_DIR = Path("/root/medeye/backups/manual_code_snapshots")
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_name = SNAPSHOT_DIR / f"code_manual_{timestamp}.tar.gz"
    
    import subprocess
    cmd = [
        "tar", "-czf", str(archive_name),
        "-C", "/root", "medeye/api",
        "--exclude=__pycache__", "--exclude=venv", "--exclude=*.db", "--exclude=*.log"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"Code snapshot created: {archive_name.name}")
        cleanup_old_archives(SNAPSHOT_DIR)
    else:
        print(f"Error creating code snapshot: {res.stderr}")

def create_all():
    create_backup()
    create_code_snapshot()

def cleanup_old_backups(backup_path):
    # Храним только 2 последних папки
    folders = sorted([f for f in backup_path.iterdir() if f.is_dir() and f.name != 'manual_code_snapshots'], 
                     key=os.path.getmtime)
    if len(folders) > KEEP_COUNT:
        for f in folders[:-KEEP_COUNT]:
            shutil.rmtree(f)
            print(f"Removed old backup: {f.name}")

def cleanup_old_archives(snapshot_dir):
    # Храним только 2 последних архива
    archives = sorted([f for f in snapshot_dir.glob("*.tar.gz")], key=os.path.getmtime)
    if len(archives) > KEEP_COUNT:
        for a in archives[:-KEEP_COUNT]:
            os.remove(a)
            print(f"Removed old code archive: {a.name}")

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
        if cmd == "create": create_all()
        elif cmd == "list": list_backups()
        elif cmd == "restore" and len(sys.argv) > 2:
            restore_backup(int(sys.argv[2]))
    else:
        print("Usage: python3 backup_system.py [create|list|restore <index>]")
