import os
import json
import datetime
import base64
import time
import shutil
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Header, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

# Импортируем наши существующие базы
from master_db import master_db
from database import MedEyeDB

# Импортируем OCR движок
from ocr_engine import gemini_parse_ocr_image, normalize_ocr_draft

# Импортируем парсеры ИОЛ
from calculators import (
    scrape_barrett_universal2_both,
    scrape_barrett_toric_both,
    scrape_kane_formula_both,
    scrape_jnj_toric_both
)

TMP_DIR = Path("tmp")
TMP_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="MedEye TMA API", version="2.1.0")

# Настройка CORS (разрешаем WebApp делать запросы к нашему API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Умная зависимость (Dependency): проверяет пользователя и выдает нужную БД
def get_clinic_db(telegram_id: str = Header(None), clinic_id: str = Header(None)) -> MedEyeDB:
    if not telegram_id:
        raise HTTPException(status_code=401, detail="Telegram-ID header is missing")
    
    # Пытаемся получить информацию о клинике (либо конкретной, либо первой доступной)
    user_info = master_db.get_user_clinic(int(telegram_id), clinic_id)
    
    if not user_info:
        # Если клиника была указана, но доступа к ней нет
        if clinic_id:
            raise HTTPException(status_code=403, detail=f"Access denied to clinic {clinic_id}")
        # Если клиника не указана и пользователя нет в системе
        raise HTTPException(status_code=403, detail="User not registered in any clinic")
        
    clinic_info = master_db.get_clinic_by_id(user_info["clinic_id"])
    if not clinic_info:
        raise HTTPException(status_code=404, detail="Clinic data not found")
        
    return MedEyeDB(clinic_info["db_file"])

@app.get("/api/me")
def get_me(telegram_id: str = Header(None)):
    """Получить информацию о текущем пользователе и список его клиник"""
    if not telegram_id:
        raise HTTPException(status_code=401, detail="Missing Telegram-ID")
    
    clinics = master_db.get_user_clinics(int(telegram_id))
    return {
        "status": "ok",
        "telegram_id": telegram_id,
        "clinics": clinics
    }

# Раздача статики (Vite Build)
# Проверяем наличие папки dist, если нет — используем корень (для совместимости)
dist_path = Path("dist")
if dist_path.exists():
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

@app.get("/")
def read_root():
    if dist_path.exists():
        return FileResponse("dist/index.html", headers=NO_CACHE_HEADERS)
    return FileResponse("ophthalmo_crm.html", headers=NO_CACHE_HEADERS)

@app.get("/crm")
def serve_crm():
    if dist_path.exists():
        return FileResponse("dist/index.html", headers=NO_CACHE_HEADERS)
    return FileResponse("ophthalmo_crm.html", headers=NO_CACHE_HEADERS)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "MedEye TMA API is running! 🚀"}

@app.get("/api/patients")
def get_patients(telegram_id: str = Header(None), db: MedEyeDB = Depends(get_clinic_db)):
    """Получить список всех пациентов клиники"""
    patients = db.get_all_patients()
    all_visits = db.get_all_visits()
    all_meas = db.get_all_meas()
    all_forms = db.get_all_forms()

    for p in patients:
        pid = p.get('patient_id')
        visit = all_visits.get(str(pid))
        form = all_forms.get(str(pid))
        
        if form and 'primary' in form:
            p['age'] = form['primary'].get('age')
            p['sex'] = form['primary'].get('sex')
            p['op_eye'] = form['primary'].get('op_eye')
            p['patient_type'] = form['primary'].get('patient_type')
            p['isEnhancement'] = form['primary'].get('isEnhancement')

        p['op_date'] = form.get('op_date') if form else None
        
        has_iol = False
        if visit:
            vid = visit.get('visit_id')
            if vid:
                meas = all_meas.get(vid)
                if meas and 'iol_calc' in meas:
                    has_iol = True
        p['has_iol_calc'] = has_iol
        
    clinic_id = "default"
    if telegram_id:
        user_info = master_db.get_user_clinic(int(telegram_id))
        if user_info:
            clinic_id = user_info.get("clinic_id", "default")
            
    return {"status": "ok", "clinic_id": clinic_id, "patients": patients}

@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str, db: MedEyeDB = Depends(get_clinic_db)):
    """Получить полную карточку конкретного пациента"""
    patient = db.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    visit = db.get_visit(patient_id)
    form = db.get_form(patient_id)

    # Сплющиваем поля из формы в объект пациента (то же самое, что делает get_patients)
    if form and 'primary' in form:
        patient['age'] = form['primary'].get('age')
        patient['sex'] = form['primary'].get('sex')
        patient['op_eye'] = form['primary'].get('op_eye')
        patient['patient_type'] = form['primary'].get('patient_type')
        patient['isEnhancement'] = form['primary'].get('isEnhancement')
    patient['op_date'] = form.get('op_date') if form else None

    return {
        "status": "ok",
        "patient": patient,
        "visit": visit,
        "form": form
    }


# --- Схемы данных (Pydantic) ---
class PatientCreate(BaseModel):
    name: str
    phone: Optional[str] = "-"
    age: Optional[str] = None
    sex: Optional[str] = None
    patient_type: Optional[str] = None
    op_eye: Optional[str] = None
    op_date: Optional[str] = None
    isEnhancement: Optional[bool] = None


class PatientUpdate(BaseModel):
    age: Optional[str] = None
    sex: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    op_date: Optional[str] = None
    op_eye: Optional[str] = None
    patient_type: Optional[str] = None
    isEnhancement: Optional[bool] = None

class OcrFile(BaseModel):
    name: str
    data: str # base64 string

class OcrJsonRequest(BaseModel):
    files: List[OcrFile]
    target: str = "all"


class IolCalcRequest(BaseModel):
    data: Dict[str, Any]

class MeasurementUpdate(BaseModel):
    data: Dict[str, Any]

@app.post("/api/patients")
def create_patient(data: PatientCreate, db: MedEyeDB = Depends(get_clinic_db)):
    """Создать нового пациента"""
    # 1. Получаем новый ID и обновляем счетчик
    pid = str(db.get_next_patient_id())
    db.set_next_patient_id(int(pid) + 1)
    
    created_at = datetime.datetime.now().isoformat(timespec="seconds")
    
    # 2. Сохраняем в базу пациентов
    db.save_patient(pid, None, data.name, data.phone, created_at)
    
    # 3. Сохраняем анкету (возраст/пол/тип/глаз)
    prim = {}
    if data.age:          prim["age"]          = data.age
    if data.sex:          prim["sex"]          = data.sex
    if data.patient_type: prim["patient_type"] = data.patient_type
    if data.op_eye:       prim["op_eye"]       = data.op_eye
    if data.isEnhancement is not None: prim["isEnhancement"] = data.isEnhancement
    db.save_form(pid, op_date=data.op_date, primary=prim)
        
    # 4. Создаем первичный открытый визит
    vid = f"V-{pid}-0000"
    db.save_visit(vid, pid, "diagnostics_in_progress", True, created_at)
    
    return {"status": "ok", "patient_id": pid, "message": "Пациент успешно создан"}


@app.post("/api/patients/{patient_id}")
def update_patient_info(patient_id: str, data: PatientUpdate, db: MedEyeDB = Depends(get_clinic_db)):
    """Обновить анкету и данные пациента (возраст, пол, ФИО)"""
    f = db.get_form(patient_id)
    if not f: f = {}
    prim = f.get("primary", {})
    if data.age is not None:
        prim["age"] = data.age
    if data.sex is not None:
        prim["sex"] = data.sex
    if data.op_eye is not None:
        prim["op_eye"] = data.op_eye
    if data.patient_type is not None:
        prim["patient_type"] = data.patient_type
    if data.isEnhancement is not None:
        prim["isEnhancement"] = data.isEnhancement

    op_date = data.op_date if data.op_date is not None else f.get("op_date")
    db.save_form(patient_id, op_date, f.get("op_time"), prim)
    
    # Обновляем основную запись пациента
    p = db.get_patient(patient_id)
    if p:
        new_name = data.name if data.name is not None else p.get("name")
        new_phone = data.phone if data.phone is not None else p.get("phone")
        db.save_patient(patient_id, p.get("chat_id"), new_name, new_phone, p.get("created_at"), p.get("archived", 0))
        
    return {"status": "ok", "message": "Данные пациента обновлены"}

@app.delete("/api/patients/{patient_id}")
def delete_patient_endpoint(patient_id: str, db: MedEyeDB = Depends(get_clinic_db)):
    """Удалить пациента полностью"""
    try:
        db.delete_patient(patient_id)
        return {"status": "ok", "message": "Пациент успешно удален"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/measurements/{visit_id}")
def get_measurements(visit_id: str, db: MedEyeDB = Depends(get_clinic_db)):
    """Получить измерения по конкретному визиту"""
    meas = db.get_meas(visit_id)
    # Убираем пустые periods: {} чтобы клиент не затирал локальные данные пустотой
    if isinstance(meas, dict) and isinstance(meas.get('periods'), dict) and not meas['periods']:
        del meas['periods']
    return {"status": "ok", "data": meas, "visit": {"visit_id": visit_id}}


@app.post("/api/measurements/{visit_id}")
def update_measurements(visit_id: str, payload: MeasurementUpdate, db: MedEyeDB = Depends(get_clinic_db)):
    """Обновить или добавить измерения в визит"""
    current_meas = db.get_meas(visit_id)
    
    # Умное слияние словарей (чтобы не затирать старые данные, если прислали только часть)
    for k, v in payload.data.items():
        if isinstance(v, dict) and isinstance(current_meas.get(k), dict):
            for sub_k, sub_v in v.items():
                if isinstance(sub_v, dict) and isinstance(current_meas[k].get(sub_k), dict):
                    current_meas[k][sub_k].update(sub_v)
                else:
                    current_meas[k][sub_k] = sub_v
        else:
            current_meas[k] = v
            
    db.save_meas(visit_id, current_meas)
    
    # Опционально: здесь можно вызывать recalc_visit_status, как мы делали в боте
    return {"status": "ok", "message": "Измерения успешно обновлены"}


@app.post("/api/ocr")
def process_ocr(payload: OcrJsonRequest):
    """Распознать медицинские распечатки с фото (OCR Gemini) - принимает JSON с base64"""
    tmp_paths = []
    tmp_dir = Path("tmp/ocr")
    tmp_dir.mkdir(parents=True, exist_ok=True)
    
    for idx, file_data in enumerate(payload.files):
        ext = os.path.splitext(file_data.name)[1] if file_data.name else ".jpg"
        if not ext: ext = ".jpg"
        tmp_path = str(tmp_dir / f"api_upload_{int(time.time())}_{idx}{ext}")
        
        try:
            # Декодируем base64 и записываем в файл
            img_bytes = base64.b64decode(file_data.data)
            with open(tmp_path, "wb") as buffer:
                buffer.write(img_bytes)
            tmp_paths.append(tmp_path)
        except Exception as e:
            print(f"[API OCR] Ошибка декодирования/записи файла base64: {e}")
            continue # Пропускаем поврежденный файл
    
    if not tmp_paths:
        raise HTTPException(status_code=400, detail="No valid image data received.")
        
    try:
        raw_draft = gemini_parse_ocr_image(tmp_paths, target=payload.target)
        clean_data = normalize_ocr_draft(raw_draft, is_ocr=True)
        
        return {
            "status": "ok",
            "data": clean_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка OCR: {str(e)}")
    finally:
        for p in tmp_paths:
            try: os.remove(p)
            except: pass


@app.post("/api/calculate_iol")
def calculate_iol(payload: IolCalcRequest):
    """Запустить парсеры калькуляторов ИОЛ (Barrett, Kane, ESCRS)"""
    print(f"\n[DEBUG] {datetime.datetime.now()} -> Получен запрос: Toric={payload.data.get('use_kane_toric')}")
    print("[API] Получен запрос на расчет ИОЛ...")
    d = payload.data
    use_b = d.get("use_barrett", False)
    use_k = d.get("use_kane", False)
    use_jnj = d.get("use_jnj", False)
    print(f"[API] Флаги: Barrett={use_b}, Kane={use_k}, J&J={use_jnj}")
    
    pat_name = d.get("name") or "Patient"
    pat_age = d.get("age") or ""
    pat_sex = d.get("sex") or ""
    a_const_b = float(d.get("const_a_barrett") or 0)
    a_const_k = float(d.get("const_a_kane") or 0)
    a_const_jnj = float(d.get("const_a_jnj") or 0)

    use_toric = d.get("use_kane_toric", False)
    sia = d.get("kane_sia") if d.get("kane_sia") is not None else (d.get("jnj_sia") if d.get("jnj_sia") is not None else 0.2)
    inc = d.get("kane_incision") if d.get("kane_incision") is not None else (d.get("jnj_incision") if d.get("jnj_incision") is not None else 90)

    req_data_b = {"patient_name": pat_name, "kane_sia": sia, "kane_incision": inc}
    req_data_k = {"patient_name": pat_name, "use_kane_toric": use_toric, "kane_sia": sia, "kane_incision": inc}
    req_data_jnj = {"patient_name": pat_name, "jnj_sia": sia, "jnj_incision": inc}
    
    for side in ["od", "os"]:
        eye_data = d.get(side, {})
        al = float(eye_data.get("al") or 0)
        k1 = float(eye_data.get("k1") or 0)
        k2 = float(eye_data.get("k2") or 0)
        acd = float(eye_data.get("acd") or 0)
        target = float(eye_data.get("target") or 0.0)
        if al > 0 and k1 > 0 and k2 > 0:
            req_data_b[side] = {"al": al, "k1": k1, "k2": k2, "acd": acd, "a_const": a_const_b, "sex": pat_sex, "target": target, "k1_ax": eye_data.get("k1_ax", 0)}
            req_data_k[side] = {"al": al, "k1": k1, "k2": k2, "acd": acd, "a_const": a_const_k, "sex": pat_sex, "k1_ax": eye_data.get("k1_ax", 0), "target": target}
            req_data_jnj[side] = {"al": al, "k1": k1, "k2": k2, "acd": acd, "a_const": a_const_jnj, "k1_ax": eye_data.get("k1_ax", 0), "target": target}

    results = {}
    errors = []

    # Запускаем все калькуляторы параллельно
    from concurrent.futures import ThreadPoolExecutor
    tasks = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        if use_b:
            # Barrett теперь всегда считаем по обычной формуле (сфера)
            print("[API] -> Запускаю Barrett Universal II (параллельно)...")
            tasks["barrett"] = pool.submit(scrape_barrett_universal2_both, req_data_b)
            
        if use_k:
            # Kane берет на себя торику, если включен режим
            if use_toric:
                print("[API] -> Запускаю Kane Toric (параллельно)...")
            else:
                print("[API] -> Запускаю Kane Universal (параллельно)...")
            tasks["kane"] = pool.submit(scrape_kane_formula_both, req_data_k)

        for name, future in tasks.items():
            try:
                res = future.result(timeout=120)
                if "error" in res:
                    errors.append(f"{name.capitalize()}: {res['error']}")
                    print(f"[API] <- {name} ОШИБКА: {res['error']}")
                else:
                    results[name] = res["result"]
                    print(f"[API] <- {name} УСПЕХ.")
            except Exception as e:
                errors.append(f"{name.capitalize()}: {str(e)}")
                print(f"[API] <- {name} ИСКЛЮЧЕНИЕ: {e}")

    print(f"[API] Отправляю ответ. Результатов: {len(results)}, Ошибок: {len(errors)}")
    return {"status": "ok", "results": results, "errors": errors}


if __name__ == "__main__":
    import uvicorn
    # Увеличиваем лимит размера запроса для OCR (base64-encoded изображение может быть очень большим)
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)