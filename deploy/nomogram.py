import sqlite3
import json

def get_nomogram_offsets(clinic_db_path):
    # This can receive either a path (string) or a db object (with execute method)
    # To be safe, we check
    if hasattr(clinic_db_path, 'execute'):
        db = clinic_db_path
    else:
        conn = sqlite3.connect(clinic_db_path)
        db = conn
    
    try:
        # Modern schema: JOIN patients -> visits -> measurements
        query = """
            SELECT p.patient_id, p.primary_data, m.data 
            FROM patients p
            JOIN visits v ON p.patient_id = v.patient_id
            JOIN measurements v_m ON v.visit_id = v_m.visit_id
            JOIN forms f ON p.patient_id = f.patient_id
            JOIN measurements m ON v.visit_id = m.visit_id
            WHERE v.status = 'done'
        """
        # Wait, the forms table has the patient_type in primary_data
        query = """
            SELECT f.primary_data, m.data 
            FROM forms f
            JOIN visits v ON f.patient_id = v.patient_id
            JOIN measurements m ON v.visit_id = m.visit_id
            WHERE v.status = 'done'
        """
        rows = db.execute(query).fetchall()
    except Exception as e:
        print(f"Nomogram Query Error: {e}")
        return {"count": 0, "proposed_offset_sph": 0, "avg_sph_error": 0}
    
    sph_errors = []
    cyl_errors = []
    
    for row in rows:
        try:
            prim = json.loads(row[0]) if row[0] else {}
            data = json.loads(row[1]) if row[1] else {}
        except:
            continue
            
        plan = data.get('savedPlan', {})
        periods = data.get('periods', {})
        
        if not plan or not periods:
            continue
        
        # Latest period
        best_period = None
        for pk in ['1y', '6m', '3m', '1m', '1w']:
            if pk in periods:
                best_period = periods[pk]
                break
        
        if not best_period:
            continue
            
        # Compare OD/OS
        for eye in ['od', 'os']:
            p_eye = plan.get(eye)
            r_eye = best_period.get(eye)
            
            if p_eye and r_eye and 'sph' in p_eye and 'sph' in r_eye:
                try:
                    p_sph = float(p_eye['sph'] or 0)
                    r_sph = float(r_eye['sph'] or 0)
                    r_cyl = float(r_eye.get('cyl') or 0)
                    
                    # Разная логика для ЛКЗ и Катаракты
                    p_type = prim.get('patient_type', 'refraction')
                    if p_type == 'cataract':
                        # Для катаракты p_sph — это Target Refraction
                        sph_errors.append(r_sph - p_sph)
                    else:
                        # Для ЛКЗ p_sph — это сила абляции (обработана номограммой)
                        sph_errors.append(r_sph)
                    
                    # Ошибка по цилиндру (всегда считаем как остаточный цилиндр)
                    if r_cyl != 0:
                        cyl_errors.append(r_cyl)
                except:
                    continue
                    
    if not sph_errors:
        return {"count": 0, "avg_sph_error": 0, "proposed_offset_sph": 0, "avg_cyl_error": 0, "proposed_offset_cyl": 0}
        
    avg_sph = sum(sph_errors) / len(sph_errors)
    avg_cyl = sum(cyl_errors) / len(cyl_errors) if cyl_errors else 0
    
    return {
        "count": len(sph_errors),
        "avg_sph_error": round(float(avg_sph), 3),
        "proposed_offset_sph": round(float(-avg_sph), 2),
        "avg_cyl_error": round(float(avg_cyl), 3),
        "proposed_offset_cyl": round(float(avg_cyl), 2),
    }

if __name__ == "__main__":
    import os
    db_test = 'clinic_test.db'
    if os.path.exists(db_test):
        stats = get_nomogram_offsets(db_test)
        print(json.dumps(stats, indent=2))
