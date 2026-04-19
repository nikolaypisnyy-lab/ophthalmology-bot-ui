# MedEye Project Knowledge Base (Memory File)
*Updated: 2026-04-19*

## 1. Project Overview
MedEye is a clinical ophthalmology CRM system with a Telegram bot for authorization and a React WebApp for surgical data management and IOL calculations.

## 2. Server Architecture
- **Production IP**: `92.38.48.231`
- **Application Directory**: `/root/medeye_bot`
- **Data Directory**: `/root/app/data` (All SQLite databases are here)
- **Virtual Env**: `/root/venv`
- **Services (systemd)**: `medeye.service` (API), `medeye-bot.service` (Telegram Bot)

## 2.1 Server Access & Credentials
- **SSH Host**: `92.38.48.231`
- **User**: `root`
- **Password**: `wIyZvBsgW8Zu`
- **Primary Admin Telegram ID**: `379286602`

## 3. Database Registry (master.db)
The central registry located at `/root/app/data/master.db` manages clinic mappings and user access.

### Active Clinics:
1. **Lucy** (Main Clinic)
   - ID: `c_af854b86`
   - File: `clinic_c_af854b86.db`
2. **DostarMed**
   - ID: `c_9d238bbf`
   - File: `clinic_c_9d238bbf.db`
3. **Clinic Test** (100 patients for testing)
   - ID: `test_clinic_999`
   - File: `clinic_test.db`

## 4. Backup & Disaster Recovery
- **Backup Script**: `/root/medeye_bot/backup_system.py`
- **Storage**: `/root/app/backups/[timestamp]/`
- **Retention**: Strictly 2 latest copies of both databases and code archives.
- **Restore Script**: `/root/medeye_bot/restore_system.py [timestamp]`
- **Telegram Command**: `🚀 Full Backup (Code+DB)` triggers a full snapshot.
- **Automated Cron**: Runs every 12 hours on the server.

## 5. Critical Technical Details
- **URL Cache Buster**: The WebApp URL in the bot includes `&v=[timestamp]` to bypass Telegram's button caching.
- **IOL Calculator**: Uses Playwright with stealth mode to scrape Kane/Barrett results.
- **Clinic Sync**: The app uses `?clinic=[ID]` URL parameter to switch between clinic contexts.
- **Deployment**: Managed via GitHub Actions (`deploy.yml`). Excludes `.db` and `.log` files.

## 7. Operational Protocols
- **Command Execution**: Use `expect` scripts for SSH interaction with the server to handle automated password entry.
- **Service Management**: Use `systemctl restart medeye medeye-bot` after any code or database configuration changes.
- **Database Edits**: Always perform edits on `/root/app/data/master.db` to ensure registry synchronization.
- **Frontend Build**: The production build is served from `/root/medeye_bot/dist`. Ensure `npm run build` is run if UI changes are made.

## 8. How to Restore Context
If the AI agent loses context, provide this file and ask:
*"Review this knowledge base and resume management of the MedEye project on server 92.38.48.231 using the provided credentials."*
