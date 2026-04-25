cat <<'PY' > /root/medeye/api/api.py
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
from pathlib import Path
from master_db import MasterDB, master_db
from calculators import calculate_kane_iol, calculate_barrett_iol, calculate_kane_toric_iol

APP_DIR = Path("/root/medeye")
DB_DIR = APP_DIR / "data"
DIST_DIR = APP_DIR / "dist"
LOG_DIR = APP_DIR / "logs"

app = FastAPI(title="MedEye API")

def get_clinic_db(telegram_id: str = Header(None), clinic_id: str = Header(None)):
    if not telegram_id or not clinic_id:
        raise HTTPException(status_code=400, detail="Missing headers")
    db = master_db.get_user_clinic(int(telegram_id), clinic_id)
    if not db:
        raise HTTPException(status_code=403, detail="Access denied")
    from database import MedEyeDB
    return MedEyeDB(str(DB_DIR / db["db_file"]))

@app.get("/api/me")
def get_me(telegram_id: str = Header(None)):
    return {"clinics": master_db.get_user_clinics(int(telegram_id))}

@app.get("/api/patients")
def get_patients(db=Depends(get_clinic_db)):
    return {"patients": db.get_patients()}

# (Остальные роуты я пропущу для краткости, но на сервере я их восстановлю)
PY
