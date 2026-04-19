import os
import sys
import shutil
import tarfile

BACKUPS_DIR = "/root/app/backups"
DATA_DIR = "/root/app/data"
APP_DIR = "/root/medeye_bot"

def restore(timestamp):
    backup_path = os.path.join(BACKUPS_DIR, timestamp)
    if not os.path.exists(backup_path):
        print(f"❌ Бэкап {timestamp} не найден.")
        return

    print(f"⌛ Восстановление из {timestamp}...")
    
    # 1. Восстановление баз данных
    for f in os.listdir(backup_path):
        if f.endswith(".db"):
            shutil.copy(os.path.join(backup_path, f), os.path.join(DATA_DIR, f))
            print(f"  - База {f} восстановлена")

    # 2. Восстановление кода (если есть архив)
    code_archive = None
    # Ищем архив кода внутри папки или в подпапке
    snapshot_dir = os.path.join(backup_path, "code_snapshots")
    if os.path.exists(snapshot_dir):
        files = [f for f in os.listdir(snapshot_dir) if f.endswith(".tar.gz")]
        if files:
            code_archive = os.path.join(snapshot_dir, files[0])

    if code_archive:
        print(f"  - Восстановление кода из {os.path.basename(code_archive)}...")
        with tarfile.open(code_archive, "r:gz") as tar:
            tar.extractall(path=APP_DIR)
        print("  - Код восстановлен")

    print("\n✅ Восстановление завершено! Перезапустите службы: systemctl restart medeye medeye-bot")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python3 restore_system.py <timestamp>")
        # Показываем список доступных бэкапов
        if os.path.exists(BACKUPS_DIR):
            print("\nДоступные бэкапы:")
            for d in sorted(os.listdir(BACKUPS_DIR), reverse=True):
                if os.path.isdir(os.path.join(BACKUPS_DIR, d)):
                    print(f"  - {d}")
    else:
        restore(sys.argv[1])
