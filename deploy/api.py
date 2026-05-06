import os
import json
import datetime
import base64
import time
import shutil
import subprocess
import sys
import requests
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Header, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fpdf import FPDF

class PdfPatient(BaseModel):
    id: str
    name: str
    age: Optional[str] = None
    sex: Optional[str] = None
    eye: str
    type: str
    details: str

class PdfRequest(BaseModel):
    clinic_name: Optional[str] = "Clinic"
    date: str
    patients: List[PdfPatient]

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# Импортируем БД и OCR
from master_db import MasterDB, master_db
from database import MedEyeDB
from ocr_engine import gemini_parse_ocr_image, normalize_ocr_draft
from nomogram import get_nomogram_offsets

# Импортируем калькуляторы
from calculators import (
    scrape_barrett_universal2_both,
    scrape_barrett_toric_both,
    scrape_kane_formula_both,
    scrape_jnj_toric_both
)
from haigis import calc_haigis, haigis_constants_from_a
from toric_engine import calculate_autonomous_toric

_API_DIR = os.path.dirname(os.path.abspath(__file__))

def run_scraper_subprocess(func_name: str, req_data: dict, timeout: int = 150) -> dict:
    """Run a Playwright scraper in an isolated subprocess to avoid event loop conflicts."""
    code = (
        "import sys, json; sys.path.insert(0, %r); "
        "from calculators import %s; "
        "data = json.loads(sys.stdin.read()); "
        "print(json.dumps(%s(data)))"
    ) % (_API_DIR, func_name, func_name)
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            input=json.dumps(req_data),
            capture_output=True, text=True, timeout=timeout
        )
        stdout = proc.stdout.strip()
        if stdout:
            for line in reversed(stdout.splitlines()):
                line = line.strip()
                if line.startswith('{'):
                    try:
                        return json.loads(line)
                    except Exception:
                        continue
        err_msg = (proc.stderr or "")[-300:] or f"rc={proc.returncode} stdout={repr(proc.stdout[:100])}"
        return {"error": err_msg}
    except subprocess.TimeoutExpired:
        return {"error": f"{func_name}: subprocess timeout ({timeout}s)"}
    except Exception as e:
        return {"error": str(e)}

# ──────────────────────────────────────────────────────────────────────────────
# Пути
# ──────────────────────────────────────────────────────────────────────────────
APP_DIR = Path("/root/medeye/api") if Path("/root/medeye/api").exists() else Path(__file__).parent.resolve()
DB_DIR = Path("/root/medeye/data") if Path("/root/medeye/data").exists() else APP_DIR
DIST_DIR = Path("/root/medeye/dist") if Path("/root/medeye/dist").exists() else (APP_DIR / "dist")
LOG_DIR = Path("/root/medeye/logs") if Path("/root/medeye/logs").exists() else (APP_DIR / "logs")

TMP_DIR = APP_DIR / "tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

TOKEN = str(os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_TOKEN") or "").strip()
master_db = MasterDB(str(DB_DIR / "master.db"))

# ──────────────────────────────────────────────────────────────────────────────
# Приложение
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="MedEye TMA API", version="2.2.0")
backup_dir = "/root/medeye/data/public_backups"
if os.path.exists(backup_dir):
    app.mount("/backups", StaticFiles(directory=backup_dir), name="backups")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_clinic_db(telegram_id: str = Header(None), clinic_id: str = Header(None)) -> MedEyeDB:
    if not telegram_id:
        raise HTTPException(status_code=401, detail="telegram-id header is missing")
    user_info = master_db.get_user_clinic(int(telegram_id), clinic_id)
    if not user_info:
        raise HTTPException(status_code=403, detail="Clinic access denied")
    db_file = user_info["db_file"]
    db_path = DB_DIR / db_file
    return MedEyeDB(str(db_path))

# ──────────────────────────────────────────────────────────────────────────────
# Схемы данных
# ──────────────────────────────────────────────────────────────────────────────
class PatientCreate(BaseModel):
    name: str
    phone: Optional[str] = "-"
    age: Optional[str] = None
    sex: Optional[str] = None
    patient_type: Optional[str] = None
    op_eye: Optional[str] = None
    op_date: Optional[str] = None
    isEnhancement: Optional[bool] = None
    flapDiam: Optional[str] = None
    capOrFlap: Optional[str] = None
    isCustomView: Optional[bool] = None
    isCustomViewOD: Optional[bool] = None
    isCustomViewOS: Optional[bool] = None
    savedEnhancement: Optional[dict] = None
    clinic_id: Optional[str] = None

class PatientUpdate(BaseModel):
    age: Optional[str] = None
    sex: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    op_date: Optional[str] = None
    op_eye: Optional[str] = None
    patient_type: Optional[str] = None
    isEnhancement: Optional[bool] = None
    flapDiam: Optional[str] = None
    capOrFlap: Optional[str] = None
    isCustomView: Optional[bool] = None
    isCustomViewOD: Optional[bool] = None
    isCustomViewOS: Optional[bool] = None
    bio_od: Optional[Dict[str, Any]] = None
    bio_os: Optional[Dict[str, Any]] = None
    iolResult: Optional[Dict[str, Any]] = None
    toricResults: Optional[Dict[str, Any]] = None
    formulaResults: Optional[Dict[str, Any]] = None
    savedPlan: Optional[Dict[str, Any]] = None
    savedEnhancement: Optional[Dict[str, Any]] = None
    periods: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    postSph: Optional[float] = None
    postCyl: Optional[float] = None
    postSphOD: Optional[float] = None
    postCylOD: Optional[float] = None
    postVaOD: Optional[str] = None
    postSphOS: Optional[float] = None
    postCylOS: Optional[float] = None
    postVaOS: Optional[str] = None
    sia: Optional[str] = None
    siaAx: Optional[str] = None
    incAx: Optional[str] = None

class OcrFile(BaseModel):
    name: str
    data: str

class OcrJsonRequest(BaseModel):
    files: List[OcrFile]
    target: str = "all"

class IolCalcRequest(BaseModel):
    data: Dict[str, Any]

class MeasurementUpdate(BaseModel):
    data: Dict[str, Any]

# ──────────────────────────────────────────────────────────────────────────────
# Статика
# ──────────────────────────────────────────────────────────────────────────────
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

NO_CACHE = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

@app.get("/")
def read_root():
    if DIST_DIR.exists():
        return FileResponse(DIST_DIR / "index.html", headers=NO_CACHE)
    return FileResponse(APP_DIR / "ophthalmo_crm.html", headers=NO_CACHE)

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "2.2.0", "db_dir": str(DB_DIR)}

@app.get("/api/me")
def get_me(telegram_id: str = Header(None)):
    if not telegram_id:
        raise HTTPException(status_code=401, detail="Missing telegram-id")
    clinics = master_db.get_user_clinics(int(telegram_id))
    return {"status": "ok", "telegram_id": telegram_id, "clinics": clinics}

# ──────────────────────────────────────────────────────────────────────────────
# Пациенты
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/api/patients")
def get_patients(telegram_id: str = Header(None), db: MedEyeDB = Depends(get_clinic_db)):
    patients = db.get_all_patients()
    all_visits = db.get_all_visits()
    all_meas = db.get_all_meas()
    all_forms = db.get_all_forms()

    for p in patients:
        pid = str(p.get("patient_id"))
        form = all_forms.get(pid)
        visit = all_visits.get(pid)

        # Подтягиваем доп. данные если их нет в основном объекте (из форм)
        if form and "primary" in form:
            pr = form["primary"]
            if not p.get("age"): p["age"] = pr.get("age")
            if not p.get("sex"): p["sex"] = pr.get("sex")
            # Форма имеет приоритет над таблицей — update_patient пишет op_eye в форму
            if pr.get("op_eye"): p["op_eye"] = pr.get("op_eye")
            elif not p.get("op_eye"): p["op_eye"] = pr.get("op_eye")
            if not p.get("patient_type"): p["patient_type"] = pr.get("patient_type")
            if p.get("isEnhancement") is None: p["isEnhancement"] = pr.get("isEnhancement")
            if not p.get("flapDiam"): p["flapDiam"] = pr.get("flapDiam")
            if not p.get("capOrFlap"): p["capOrFlap"] = pr.get("capOrFlap")
        
        if not p.get("op_date"):
            p["op_date"] = form.get("op_date") if form else None

        if visit:
            vid = visit.get("visit_id", "")
            latest_meas = all_meas.get(vid)
            if latest_meas and "iol_calc" in latest_meas:
                p["has_iol_calc"] = True
            
        # Ищем флэп ТОЛЬКО в Плане Операции (surgery_plan)
        if not p.get("flapDiam") or not p.get("capOrFlap"):
            c = db.conn.cursor()
            c.execute("""
                SELECT m.data
                FROM measurements m
                JOIN visits v ON m.visit_id = v.visit_id
                WHERE v.patient_id = ?
                ORDER BY v.created_at DESC
            """, (pid,))
            for row in c.fetchall():
                try:
                    m_data = json.loads(row[0])
                    plan = m_data.get("surgery_plan", {})
                    # Берем напрямую из плана
                    if not p.get("flapDiam"):  p["flapDiam"] = plan.get("flapDiam")
                    if not p.get("capOrFlap"): p["capOrFlap"] = plan.get("capOrFlap")
                    if p.get("isCustomView") is None: p["isCustomView"] = plan.get("isCustomView")
                    if p.get("isCustomViewOD") is None: p["isCustomViewOD"] = plan.get("isCustomViewOD")
                    if p.get("isCustomViewOS") is None: p["isCustomViewOS"] = plan.get("isCustomViewOS")
                    
                    # Добавляем сохранённый план в суммари
                    if plan and ("od" in plan or "os" in plan):
                        p["savedPlan"] = {}
                        for side in ["od", "os"]:
                            if side in plan:
                                sp = plan[side]
                                p["savedPlan"][side] = {
                                    "sph": sp.get("sph", 0),
                                    "cyl": sp.get("cyl", 0),
                                    "ax":  sp.get("axis", 0),
                                    "flap": sp.get("flap")
                                }
                except: continue
                if p.get("flapDiam") and p.get("capOrFlap"): break

        if visit:
            vid = visit.get("visit_id", "")
            latest_meas = all_meas.get(vid)
            
            if latest_meas:
                periods = latest_meas.get("periods", {})
                if periods:
                    for pk in ["1y", "6m", "3m", "1m", "1w", "1d"]:
                        pr = periods.get(pk)
                        if pr:
                            od, os = pr.get("od"), pr.get("os")
                            if od and od.get("sph") is not None:
                                p["postSphOD"], p["postCylOD"], p["postAxOD"], p["postVaOD"] = od.get("sph"), od.get("cyl"), od.get("ax"), od.get("va")
                                p["status"] = "done"
                            if os and os.get("sph") is not None:
                                p["postSphOS"], p["postCylOS"], p["postAxOS"], p["postVaOS"] = os.get("sph"), os.get("cyl"), os.get("ax"), os.get("va")
                                p["status"] = "done"
                            ou = pr.get("ou")
                            if ou and ou.get("va") is not None:
                                p["postVaOU"] = ou.get("va")
                            if "status" in p: break
                
                # Also include IOL results for ResultsPage display
                if "iolResult" in latest_meas:
                    p["iolResult"] = latest_meas["iolResult"]
                elif "iol_calc" in latest_meas:
                    # Reconstruct iolResult from selected_iol
                    sel = latest_meas["iol_calc"].get("selected_iol") if isinstance(latest_meas.get("iol_calc"), dict) else None
                    if isinstance(sel, dict):
                        iol_r = {}
                        for side in ["od", "os"]:
                            sd = sel.get(side)
                            if isinstance(sd, dict) and sd.get("power") is not None:
                                eye_data = {"selectedPower": sd["power"]}
                                if sd.get("selectedToricModel"):
                                    eye_data["selectedToricModel"] = sd["selectedToricModel"]
                                if sd.get("expected_refr") is not None:
                                    eye_data["expectedRefr"] = sd["expected_refr"]
                                iol_r[side] = eye_data
                                if sd.get("model"):
                                    iol_r["lens"] = sd["model"]
                        if iol_r:
                            p["iolResult"] = iol_r
                if "toricResults" in latest_meas:
                    p["toricResults"] = latest_meas["toricResults"]
                if "iol_calc" in latest_meas:
                    p["has_iol_calc"] = True

    clinic_id = "default"
    if telegram_id:
        ui = master_db.get_user_clinic(int(telegram_id))
        if ui: clinic_id = ui.get("clinic_id", "default")

    return {"status": "ok", "clinic_id": clinic_id, "patients": patients}

@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str, db: MedEyeDB = Depends(get_clinic_db)):
    patient = db.get_patient(patient_id)
    if not patient: raise HTTPException(status_code=404, detail="Patient not found")
    visit = db.get_visit(patient_id)
    form = db.get_form(patient_id)
    if form and "primary" in form:
        pr = form["primary"]
        if not patient.get("age"): patient["age"] = pr.get("age")
        if not patient.get("sex"): patient["sex"] = pr.get("sex")
        if pr.get("op_eye"): patient["op_eye"] = pr.get("op_eye")
        elif not patient.get("op_eye"): patient["op_eye"] = pr.get("op_eye")
        if not patient.get("patient_type"): patient["patient_type"] = pr.get("patient_type")
        if not patient.get("flapDiam"): patient["flapDiam"] = pr.get("flapDiam")
        if not patient.get("savedEnhancement"): patient["savedEnhancement"] = pr.get("savedEnhancement")
    return {"status": "ok", "patient": patient, "visit": visit, "form": form}

@app.post("/api/patients")
def create_patient(data: PatientCreate, db: MedEyeDB = Depends(get_clinic_db)):
    pid = str(db.get_next_patient_id())
    db.set_next_patient_id(int(pid) + 1)
    created_at = datetime.datetime.now().isoformat(timespec="seconds")
    db.save_patient(pid, None, data.name, data.phone, created_at, 0, data.flapDiam, data.capOrFlap, 1 if data.isCustomView else 0, 1 if data.isCustomViewOD else 0, 1 if data.isCustomViewOS else 0)

    prim = {"age": data.age, "sex": data.sex, "patient_type": data.patient_type, "op_eye": data.op_eye, "isEnhancement": data.isEnhancement, "flapDiam": data.flapDiam, "capOrFlap": data.capOrFlap, "savedEnhancement": data.savedEnhancement}
    db.save_form(pid, op_date=data.op_date, primary=prim)

    vid = f"V-{pid}-0000"
    db.save_visit(vid, pid, "diagnostics_in_progress", True, created_at)
    return {"status": "ok", "patient_id": pid, "message": "Пациент успешно создан"}

@app.post("/api/patients/{patient_id}")
def update_patient(patient_id: str, data: PatientUpdate, db: MedEyeDB = Depends(get_clinic_db)):
    f = db.get_form(patient_id) or {}
    prim = f.get("primary", {})
    for k, v in data.dict(exclude_unset=True).items():
        if k in ["name", "phone", "op_date"]: continue
        prim[k] = v
    op_date = data.op_date if data.op_date is not None else f.get("op_date")
    db.save_form(patient_id, op_date, f.get("op_time"), prim)

    p = db.get_patient(patient_id)
    if p:
        db.save_patient(
            patient_id, p.get("chat_id"),
            data.name if data.name is not None else p.get("name"),
            data.phone if data.phone is not None else p.get("phone"),
            p.get("created_at"), p.get("archived", 0),
            data.flapDiam if data.flapDiam is not None else p.get("flapDiam"),
            data.capOrFlap if data.capOrFlap is not None else p.get("capOrFlap"),
            int(data.isCustomView) if data.isCustomView is not None else p.get("isCustomView", 0),
            int(data.isCustomViewOD) if data.isCustomViewOD is not None else p.get("isCustomViewOD", 0),
            int(data.isCustomViewOS) if data.isCustomViewOS is not None else p.get("isCustomViewOS", 0)
        )
    return {"status": "ok", "message": "Данные пациента обновлены"}

@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: str, db: MedEyeDB = Depends(get_clinic_db)):
    db.delete_patient(patient_id)
    return {"status": "ok", "message": "Пациент удален"}

@app.get("/api/measurements/{visit_id}")
def get_measurements(visit_id: str, db: MedEyeDB = Depends(get_clinic_db)):
    meas = db.get_meas(visit_id)
    return {"status": "ok", "data": meas, "visit": {"visit_id": visit_id}}

@app.post("/api/measurements/{visit_id}")
def update_measurements(visit_id: str, payload: MeasurementUpdate, db: MedEyeDB = Depends(get_clinic_db)):
    current = db.get_meas(visit_id)
    for k, v in payload.data.items():
        if isinstance(v, dict) and isinstance(current.get(k), dict):
            current[k].update(v)
        else:
            current[k] = v
    db.save_meas(visit_id, current)
    # Пытаемся обновить метаданные флэпа в таблице пациентов
    p_id = visit_id.split("-")[1] if "-" in visit_id else None
    if p_id:
        fDiam = payload.data.get("flapDiam")
        cFlap = payload.data.get("capOrFlap")
        isCV = payload.data.get("isCustomView")
        isCVOD = payload.data.get("isCustomViewOD")
        isCVOS = payload.data.get("isCustomViewOS")
        if fDiam or cFlap or isCV is not None or isCVOD is not None or isCVOS is not None:
            p = db.get_patient(p_id)
            if p:
                db.save_patient(p_id, p.get("chat_id"), p.get("name"), p.get("phone"), p.get("created_at"), p.get("archived", 0),
                                fDiam or p.get("flapDiam"), cFlap or p.get("capOrFlap"),
                                int(isCV) if isCV is not None else p.get("isCustomView", 0),
                                int(isCVOD) if isCVOD is not None else p.get("isCustomViewOD", 0),
                                int(isCVOS) if isCVOS is not None else p.get("isCustomViewOS", 0))
    return {"status": "ok", "message": "Измерения обновлены"}

@app.get("/api/nomogram")
def get_nomogram(db: MedEyeDB = Depends(get_clinic_db)):
    return get_nomogram_offsets(db.db_path)

@app.get("/api/database/export")
def database_export(tid: str, cid: Optional[str] = None):
    user_info = master_db.get_user_clinic(int(tid), cid)
    if not user_info: raise HTTPException(status_code=403)
    db_path = DB_DIR / user_info["db_file"]
    return FileResponse(str(db_path), filename=f"medeye_backup_{tid}.db")

@app.post("/api/database/export_telegram")
def database_export_telegram(telegram_id: str = Header(None), clinic_id: str = Header(None)):
    user_info = master_db.get_user_clinic(int(telegram_id), clinic_id)
    if not user_info: raise HTTPException(status_code=403)
    db_path = DB_DIR / user_info["db_file"]
    url = f"https://api.telegram.org/bot{TOKEN}/sendDocument"
    with open(db_path, "rb") as f:
        requests.post(url, data={"chat_id": telegram_id, "caption": f"База ({user_info.get('clinic_name','')})"}, files={"document": f})
    return {"status": "ok"}

@app.post("/api/ocr")
def process_ocr(payload: OcrJsonRequest):
    tmp_dir = TMP_DIR / "ocr"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_paths = []
    for idx, f in enumerate(payload.files):
        tmp_path = str(tmp_dir / f"up_{int(time.time())}_{idx}.jpg")
        with open(tmp_path, "wb") as buf: buf.write(base64.b64decode(f.data))
        tmp_paths.append(tmp_path)
    try:
        raw = gemini_parse_ocr_image(tmp_paths, target=payload.target)
        return {"status": "ok", "data": normalize_ocr_draft(raw, is_ocr=True)}
    finally:
        for p in tmp_paths:
            try: os.remove(p)
            except: pass

@app.post("/api/calculate_iol")
def calculate_iol(payload: IolCalcRequest):
    d = payload.data
    formula = d.get("formula", "Barrett").lower()
    active_eye = d.get("active_eye", "od").lower()
    
    # Собираем данные для скраперов в ожидаемом ими формате
    req_data = {
        "patient_name": "Patient",
        "kane_sia": float(d.get("sia") or 0.1),
        "kane_incision": int(d.get("k_ax") or 90),
    }
    
    # Маппим данные активного глаза
    req_data[active_eye] = {
        "al": float(d.get("al") or d.get("bio_al") or 0),
        "k1": float(d.get("k1") or 0),
        "k2": float(d.get("k2") or 0),
        "acd": float(d.get("acd") or d.get("bio_acd") or 0),
        "lt": float(d.get("lt") or d.get("bio_lt") or 0),
        "wtw": float(d.get("wtw") or d.get("bio_wtw") or 0),
        "a_const": float(d.get("a_const") or d.get("aConst") or 119.3),
        "target": float(d.get("target") or d.get("targetRefr") or d.get("target_refr") or 0),
    }

    results = []
    errors = []

    try:
        print(f"[CALC] Formula={formula} Eye={active_eye} Data={d}", flush=True)
        
        toric_data = None
        if d.get("toricMode"):
            try:
                from toric_engine import REFRACTIVE_INDICES
                n_label = d.get("n_aq_label", "Standard (1.336)")
                n_aq    = REFRACTIVE_INDICES.get(n_label, 1.336)
                toric_data = calculate_autonomous_toric(
                    k1=float(d.get("k1") or 0),
                    k2=float(d.get("k2") or 0),
                    k1_axis=float(d.get("k1_ax") or d.get("k_ax") or 0),
                    sia=float(d.get("sia") or 0.1),
                    inc_axis=float(d.get("incAx") or 90),
                    al=float(d.get("al") or d.get("bio_al") or 23.5),
                    acd=float(d.get("acd") or d.get("bio_acd") or 3.2),
                    n_aq=n_aq,
                    iol_db=d.get("iol_db", "Alcon SN6AT"),
                    k_ax_is_steep=bool(d.get("k_ax_is_steep", False)),
                )
                print(f"[CALC] Toric: best={toric_data['best_model']} bvr={toric_data['bvr']} elp={toric_data['elp_mm']}mm", flush=True)
            except Exception as te:
                print(f"[CALC] Toric engine error: {te}")

        if "haigis" in formula:
            from haigis import haigis_constants_from_a, calc_haigis

            a_const = float(d.get("a_const") or 118.5)
            h_consts = haigis_constants_from_a(a_const)

            h_res = calc_haigis(
                al=float(d.get("al") or 0),
                acd=float(d.get("acd") or 0),
                k1=float(d.get("k1") or 0),
                k2=float(d.get("k2") or 0),
                constants=h_consts,
                target_rx=float(d.get("target_refr") or 0)
            )

            if isinstance(h_res, dict) and "error" in h_res:
                errors.append(h_res["error"])
            else:
                table = getattr(h_res, 'table', [])
                for idx, row in enumerate(table):
                    results.append({
                        "power": row.power,
                        "refraction": row.refraction,
                        "is_emmetropia": idx == 3
                    })
        else:
            if "kane" in formula:
                r = run_scraper_subprocess("scrape_kane_formula_both", req_data)
            else:
                r = run_scraper_subprocess("scrape_barrett_universal2_both", req_data)

            if "error" in r:
                errors.append(r["error"])
            else:
                # Скраперы возвращают {"result": {eye: {p_emmetropia, table: [{power, ref}]}}}
                eye_data = r.get(active_eye) or r.get("result", {}).get(active_eye) or {}
                table = eye_data.get("table", []) if isinstance(eye_data, dict) else []
                p_em = eye_data.get("p_emmetropia") if isinstance(eye_data, dict) else None
                for row in table:
                    power = row.get("power", 0)
                    refr = row.get("ref", row.get("refraction", 0))
                    results.append({
                        "power": power,
                        "refraction": refr,
                        "is_emmetropia": p_em is not None and abs(power - p_em) < 0.01
                    })
                if not results:
                    errors.append("No results returned for active eye")
    except Exception as e:
        errors.append(str(e))

    status = "ok" if results else "error"
    detail = errors[0] if errors else None
    
    return {
        "status": status, 
        "data": results, 
        "toric": toric_data,
        "detail": detail
    }

@app.post("/api/send_surgical_pdf")
async def send_surgical_pdf(payload: PdfRequest, telegram_id: str = Header(None)):
    print(f"[PDF] Request: Clinic={payload.clinic_name}, Date={payload.date}, Patients={len(payload.patients)}, User={telegram_id}", flush=True)
    if not telegram_id: raise HTTPException(401)
    
    pdf = FPDF()
    pdf.add_page()
    
    # Пытаемся найти кириллический шрифт
    font_path = None
    for p in [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "DejaVuSans.ttf"
    ]:
        if os.path.exists(p):
            font_path = p
            break
            
    if font_path:
        pdf.add_font("Custom", "", font_path)
        pdf.set_font("Custom", size=10)
    else:
        pdf.set_font("Helvetica", size=10)

    # Header
    pdf.set_font(pdf.font_family, style="B" if not font_path else "", size=16)
    pdf.cell(0, 10, payload.clinic_name, ln=True, align="L")
    pdf.set_font(pdf.font_family, size=10)
    pdf.cell(0, 8, f"Surgical Day: {payload.date}", ln=True, align="L")
    pdf.ln(10)

    # Table Header
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font(pdf.font_family, style="B" if not font_path else "", size=9)
    pdf.cell(10, 10, "#", border=1, align="C", fill=True)
    pdf.cell(60, 10, "Patient", border=1, align="L", fill=True)
    pdf.cell(20, 10, "Eye", border=1, align="C", fill=True)
    pdf.cell(100, 10, "Surgical Details", border=1, align="L", fill=True)
    pdf.ln()

    # Table Rows
    pdf.set_font(pdf.font_family, size=9)
    for idx, p in enumerate(payload.patients):
        # Очищаем детали от HTML тегов (<b> и т.д.)
        clean_details = p.details.replace("<b>", "").replace("</b>", "").replace("<br>", " ").replace("<div class='detail-row'>", "").replace("</div>", "\n").strip()
        
        # Вычисляем высоту ячейки по контенту
        row_height = 8
        if "\n" in clean_details: row_height = 12
        
        # Сохраняем текущую позицию
        x, y = pdf.get_x(), pdf.get_y()

        pdf.cell(10, row_height, str(idx + 1), border=1, align="C")

        # Patient name + age
        pdf.set_font(pdf.font_family, style="B" if not font_path else "", size=10)
        age_str = f"  {p.age} y.o." if p.age else ""
        pdf.cell(60, row_height, (p.name[:22] + age_str)[:30], border=1)
        pdf.set_font(pdf.font_family, size=9)

        pdf.cell(20, row_height, p.eye, border=1, align="C")

        # Details (Multi-line)
        pdf.multi_cell(100, row_height/2 if "\n" in clean_details else row_height, clean_details, border=1, align="L")

        # Сбрасываем курсор на начало следующей строки
        pdf.set_xy(x, y + row_height)
        
    # Disclaimer footer
    pdf.ln(8)
    pdf.set_font(pdf.font_family, size=7)
    pdf.set_text_color(150, 150, 150)
    pdf.multi_cell(0, 5,
        "DISCLAIMER: This document was generated by RefMaster — a clinical decision support tool. "
        "It is not a medical device and does not replace professional medical judgment. "
        "The treating physician bears full responsibility for all clinical decisions.",
        align="L")
    pdf.set_text_color(0, 0, 0)

    # Save PDF to buffer
    out_path = TMP_DIR / f"surgical_{telegram_id}_{int(time.time())}.pdf"
    pdf.output(str(out_path))

    # Send to Telegram
    import requests
    try:
        url = f"https://api.telegram.org/bot{TOKEN}/sendDocument"
        with open(out_path, "rb") as f:
            r = requests.post(
                url,
                data={"chat_id": telegram_id, "caption": f"Surgical Schedule: {payload.clinic_name} ({payload.date})"},
                files={"document": f},
                timeout=30
            )
        
        print(f"[PDF] Telegram Send Result: {r.status_code} - {r.text}", flush=True)
        r.raise_for_status()
        
        # Cleanup
        if os.path.exists(out_path): os.remove(out_path)
        
        return {"status": "ok", "tg_result": r.json()}
    except Exception as e:
        print(f"[PDF] ERROR sending to Telegram: {str(e)}", flush=True)
        if os.path.exists(out_path):
            try: os.remove(out_path)
            except: pass
        return {"status": "error", "detail": f"Telegram Error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)