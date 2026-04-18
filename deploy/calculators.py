import math
import urllib.request
import urllib.parse
import urllib.error
import http.cookiejar
import re
from typing import Dict, Any, Optional

def suggest_flap_diameter(wtw_value: Optional[float]) -> float:
    if wtw_value is None:
        return 9.0
    
    if wtw_value < 11.4:
        return 8.7
    elif wtw_value < 11.8:
        return 8.8
    elif wtw_value < 12.1:
        return 8.9
    else:
        return 9.0

def calculate_lenticule_thickness_smile(sph: float, cyl: float, optical_zone: float) -> float:
    """
    Calculates refractive lenticule thickness (without min thickness) for SMILE.
    Formula: Depth = (SE * OZ^2) / 3
    SE = |Sph + Cyl/2|
    """
    se = abs(sph + (cyl / 2.0))
    depth = (se * (optical_zone ** 2)) / 3.0
    return depth

def calculate_ablation_wfo(sph: float, cyl: float, optical_zone: float, k_pre: Optional[float] = None) -> Dict[str, Any]:
    """
    Рассчитывает глубину абляции для лазера Alcon WaveLight EX500 (профиль WFO).
    """
    # Для миопии и миопического астигматизма
    if sph <= 0 and cyl <= 0:
        depth = ((optical_zone ** 2) * abs(sph) / 3.0) * 1.25 + ((optical_zone ** 2) * abs(cyl) / 6.0) * 1.25
    # Для чистой гиперметропии (периферический профиль, в центре почти не жжет)
    elif sph > 0 and sph + cyl >= 0:
        depth = 15.0 
    # Для смешанного астигматизма (центральная глубина зависит от миопического меридиана)
    elif sph > 0 and sph + cyl < 0:
        depth = ((optical_zone ** 2) * abs(sph + cyl) / 3.0) * 1.25
    else:
        depth = ((optical_zone ** 2) * abs(sph) / 3.0) * 1.25 + ((optical_zone ** 2) * abs(cyl) / 6.0) * 1.25
    
    result = {"depth": round(depth, 2)}
    
    if k_pre is not None:
        se = sph + (cyl / 2.0)
        k_post = k_pre + se
        result["k_post"] = round(k_post, 2)
        if k_post < 34.0:
            result["warning"] = "Внимание: Роговица будет слишком плоской (K < 34D)."
        elif k_post > 48.0:
            result["warning"] = "Внимание: Роговица будет слишком крутой (K > 48D). Риск аберраций и ССГ."
            
    return result

def calculate_srkt(al: float, k1: float, k2: float, a_const: float) -> Dict[str, Any]:
    """
    Расчет ИОЛ по классической формуле SRK/T.
    """
    try:
        k = (k1 + k2) / 2.0
        r = 337.5 / k
        
        lcor = al if al <= 24.2 else -3.446 + 1.716 * al - 0.0237 * (al ** 2)
        
        cw = -5.41 + 0.58412 * lcor + 0.098 * k
        val = (r ** 2) - ((cw ** 2) / 4.0)
        h = r - math.sqrt(val if val > 0 else 0)
        
        acd_est = h + 0.62467 * a_const - 68.747 - 3.336
        
        n = 1.336
        nc = 0.333
        
        num_em = 1000 * n * (n * r - nc * lcor)
        den_em = (lcor - acd_est) * (n * r - nc * acd_est)
        p_em = num_em / den_em
        
        r_factor = 1.25
        if al > 25.0: r_factor = 1.35
        if al < 22.0: r_factor = 1.15
        
        base_p = round(p_em * 2) / 2.0
        table = [{"power": base_p + step, "ref": (p_em - (base_p + step)) / r_factor} for step in [1.5, 1.0, 0.5, 0.0, -0.5, -1.0, -1.5]]
            
        return {"p_emmetropia": round(p_em, 2), "table": table}
    except Exception as e:
        return {"error": str(e)}

def scrape_barrett_universal2_both(data: dict) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "Библиотека Playwright не установлена. Выполните: pip install playwright"}
        
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox',
                      '--disable-dev-shm-usage', '--disable-gpu',
                      '--disable-blink-features=AutomationControlled']
            )
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport={'width': 1280, 'height': 800}
            )
            
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            page.goto("https://calc.apacrs.org/barrett_universal2105/", timeout=45000)
            
            # 1. Соглашение (I Agree)
            try:
                agree_btn = page.locator("input[value*='Agree' i], button:has-text('Agree')").first
                if agree_btn.is_visible(timeout=3000):
                    agree_btn.click()
                    page.wait_for_load_state("networkidle")
            except:
                pass
            
            # 2. Ждем основное поле (по точному ID)
            page.wait_for_selector("#MainContent_Axlength", state="visible", timeout=15000)
            
            # 3. Общие поля
            pat_name = data.get("patient_name", "Patient")
            page.fill("#MainContent_PatientName", str(pat_name))
            page.fill("#MainContent_DoctorName", "MedEye")
            
            a_const = None
            if "od" in data and data["od"].get("a_const"): a_const = data["od"]["a_const"]
            elif "os" in data and data["os"].get("a_const"): a_const = data["os"]["a_const"]
            if a_const:
                page.fill("#MainContent_Aconstant", str(a_const))
                
            # 4. Заполнение биометрии
            eyes_processed = []
            for side in ["od", "os"]:
                if side not in data or not data[side].get("al"):
                    continue
                eyes_processed.append(side)
                d = data[side]
                
                # Левый глаз у них с нулем на конце
                suffix = "0" if side == "os" else ""
                page.fill(f"#MainContent_Axlength{suffix}", str(d.get("al")))
                page.fill(f"#MainContent_MeasuredK1{suffix}", str(d.get("k1")))
                page.fill(f"#MainContent_MeasuredK2{suffix}", str(d.get("k2")))
                if d.get("acd"):
                    page.fill(f"#MainContent_OpticalACD{suffix}", str(d.get("acd")))
            
            if not eyes_processed:
                browser.close()
                return {"error": "Нет полных данных ПЗО для расчета."}
                
            # 5. Нажимаем кнопку Calculate и правильно ждем начала перезагрузки
            try:
                with page.expect_navigation(timeout=10000):
                    page.click("#MainContent_Button1")
            except Exception:
                pass # Защита на случай, если страница подгрузилась без полного обновления
            
            page.wait_for_timeout(2000)
            
            # 6. ЕДИНОРАЗОВЫЙ клик по вкладке (чтобы не перезагружать страницу в цикле)
            try:
                page.evaluate("""() => {
                    let links = Array.from(document.querySelectorAll('a, button, span'));
                    let tab = links.find(l => l.textContent.toLowerCase().includes('universal formula') || l.textContent.toLowerCase().includes('universal ii'));
                    if (tab) tab.click();
                }""")
            except Exception:
                pass
            
            # 7. Цикл ожидания таблиц (до 10 секунд, только чтение, без кликов!)
            valid_tables = []
            for _ in range(10):
                page.wait_for_timeout(1000)
                
                try:
                    js_extract = """
                    () => {
                        let res = [];
                        document.querySelectorAll('table').forEach(tbl => {
                            let rows = [];
                            tbl.querySelectorAll('tr').forEach(tr => {
                                let cols = [];
                                tr.querySelectorAll('td, th').forEach(td => cols.push(td.textContent.trim()));
                                if(cols.length > 0) rows.push(cols);
                            });
                            res.push(rows);
                        });
                        return res;
                    }
                    """
                    raw_tables = page.evaluate(js_extract)
                except Exception:
                    # Если контекст разрушен из-за навигации, просто ждем следующей итерации
                    continue
                    
                valid_tables = []
                
                for tbl in raw_tables:
                    parsed_tbl = []
                    for r in tbl:
                        nums = []
                        for c in r:
                            matches = re.findall(r'[-+]?\d*\.\d+|[-+]?\d+', c.replace(',', '.'))
                            if matches:
                                try: nums.append(float(matches[0]))
                                except: pass
                        if len(nums) >= 2:
                            pwr, ref = None, None
                            # Ищем пару чисел, похожую на (Сила ИОЛ, Рефракция)
                            for j in range(len(nums) - 1):
                                if -10 <= nums[j] <= 45 and -15 <= nums[j+1] <= 15:
                                    pwr = nums[j]
                                    ref = nums[j+1]
                                    break
                            if pwr is not None and ref is not None:
                                parsed_tbl.append({"power": pwr, "ref": ref})
                                
                    if len(parsed_tbl) >= 3:
                        unique_tbl = []
                        seen = set()
                        for pt in parsed_tbl:
                            k = (pt["power"], pt["ref"])
                            if k not in seen:
                                seen.add(k)
                                unique_tbl.append(pt)
                        unique_tbl.sort(key=lambda x: x["power"], reverse=True)
                        valid_tables.append(unique_tbl)
                
                if len(valid_tables) >= len(eyes_processed):
                    break # Нашли нужное количество таблиц!
            
            for i, side in enumerate(eyes_processed):
                if i < len(valid_tables):
                    tbl = valid_tables[i]
                    target = float(data[side].get("target", 0.0))
                    em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                    out[side] = {"p_emmetropia": em_row["power"], "table": tbl}
                else:
                    out[side] = {"error": "Таблица не распарсилась или не появилась на сайте."}
                
            browser.close()
            
        if not out:
            return {"error": "Сайт не вернул результаты ни для одного глаза."}
        return {"result": out}

    except Exception as e:
        return {"error": f"Ошибка Playwright: {str(e)}"}

def scrape_barrett_toric_both(data: dict) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "Библиотека Playwright не установлена."}
        
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-blink-features=AutomationControlled']
            )
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport={'width': 1280, 'height': 800}
            )
            
            page = context.new_page()
            page.goto("https://calc.apacrs.org/barrett_toric105/", timeout=30000)
            
            # 1. Agree
            try:
                agree_btn = page.locator("input[value*='Agree' i], button:has-text('Agree')").first
                if agree_btn.is_visible(timeout=3000):
                    agree_btn.click()
                    page.wait_for_load_state("networkidle")
            except: pass
            
            page.wait_for_selector("#MainContent_Axlength", state="visible", timeout=15000)
            
            # 2. Global fields
            pat_name = data.get("patient_name", "Patient")
            page.fill("#MainContent_PatientName", str(pat_name))
            page.fill("#MainContent_DoctorName", "MedEye")
            
            a_const = data.get("od", {}).get("a_const") or data.get("os", {}).get("a_const")
            if a_const:
                page.fill("#MainContent_Aconstant", str(a_const))
            
            sia = data.get("jnj_sia") or data.get("kane_sia") or 0.2
            incision = data.get("jnj_incision") or data.get("kane_incision") or 90
            
            page.fill("#MainContent_IncisionLocation", str(incision))
            page.fill("#MainContent_Sia", str(sia))
            
            # 3. Eyes
            eyes_processed = []
            for side in ["od", "os"]:
                if side not in data or not data[side].get("al"):
                    continue
                eyes_processed.append(side)
                d = data[side]
                suffix = "0" if side == "os" else ""
                
                page.fill(f"#MainContent_Axlength{suffix}", str(d.get("al")))
                page.fill(f"#MainContent_MeasuredK1{suffix}", str(d.get("k1")))
                page.fill(f"#MainContent_MeasuredK2{suffix}", str(d.get("k2")))
                page.fill(f"#MainContent_K1Axis{suffix}", str(d.get("k1_ax", 0)))
                if d.get("acd"):
                    page.fill(f"#MainContent_OpticalACD{suffix}", str(d.get("acd")))

            if not eyes_processed:
                browser.close()
                return {"error": "Нет данных для расчета."}
                
            # 4. Calculate
            try:
                with page.expect_navigation(timeout=10000):
                    page.click("#MainContent_Button1")
            except: pass
            
            page.wait_for_timeout(2000)
            
            # 5. Extract tables
            # Barrett Toric returns results in a specific format
            valid_results = {}
            for _ in range(10):
                page.wait_for_timeout(1000)
                js_extract = """
                () => {
                    let res = [];
                    document.querySelectorAll('table').forEach(tbl => {
                        let rows = [];
                        tbl.querySelectorAll('tr').forEach(tr => {
                            let cols = [];
                            tr.querySelectorAll('td, th').forEach(td => cols.push(td.textContent.trim()));
                            if(cols.length > 0) rows.push(cols);
                        });
                        res.push(rows);
                    });
                    return res;
                }
                """
                raw_tables = page.evaluate(js_extract)
                
                # Barrett Toric results are usually in tables containing "IOL Power" and "Cylinder"
                for i, side in enumerate(eyes_processed):
                    if side in valid_results: continue
                    
                    # Search for a table that looks like Barrett Toric output for this eye
                    for tbl in raw_tables:
                        parsed_tbl = []
                        for r in tbl:
                            # We look for rows with (Power, Cyl, Residual, Axis)
                            # E.g. [20.0, 1.5, 0.25, 175]
                            nums = []
                            for c in r:
                                m = re.findall(r'[-+]?\d*\.\d+|[-+]?\d+', c.replace(',', '.'))
                                if m: nums.append(float(m[0]))
                            
                            if len(nums) >= 3:
                                # Power usually 5-35, Cyl 1-8
                                pwr, cyl, res_cyl, res_ax = None, None, None, None
                                for j in range(len(nums)-2):
                                    if 5 <= nums[j] <= 40 and 0.5 <= nums[j+1] <= 15:
                                        pwr = nums[j]
                                        cyl = nums[j+1]
                                        res_cyl = nums[j+2]
                                        if j+3 < len(nums): res_ax = nums[j+3]
                                        break
                                if pwr is not None:
                                    parsed_tbl.append({"power": pwr, "cyl_power": cyl, "residual_cyl": res_cyl, "axis": res_ax})
                                    
                        if len(parsed_tbl) >= 1:
                            # Emmetropia row
                            target = float(data[side].get("target", 0.0))
                            # Simplification for Barrett Toric: often it returns the recommended lens
                            # We'll just take the whole table
                            valid_results[side] = parsed_tbl
                            break
                
                if len(valid_results) >= len(eyes_processed):
                    break

            for side in eyes_processed:
                if side in valid_results:
                    tbl = valid_results[side]
                    # We need to map it back to a standard format for CalcTab
                    # Barrett Toric often returns specific power/cyl pairs
                    # We'll pick one as emmetropia for the UI's sake
                    em_row = tbl[0] 
                    out[side] = {
                        "p_emmetropia": em_row["power"],
                        "best_cyl": em_row["cyl_power"],
                        "toric_table": tbl,
                        "table": [{"power": r["power"], "ref": r["residual_cyl"]} for r in tbl] # fake spherical table
                    }
                else:
                    out[side] = {"error": "Не удалось извлечь таблицу Barrett Toric."}
            
            browser.close()
            return {"result": out}
    except Exception as e:
        return {"error": f"Ошибка Barrett Toric: {str(e)}"}

def scrape_kane_formula_both(data: dict) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "Библиотека Playwright не установлена."}

    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-blink-features=AutomationControlled']
            )
            import os, json as json_lib
            ctx_args = {
                "user_agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                "viewport": {'width': 1280, 'height': 800}
            }
            if os.path.exists("kane_state.json"):
                ctx_args["storage_state"] = "kane_state.json"

            context = browser.new_context(**ctx_args)

            pat_name = data.get("patient_name", "Patient")
            is_toric = data.get("use_kane_toric", False)
            sia = data.get("kane_sia", 0.2)
            incision = data.get("kane_incision", 90)

            original_eyes = []
            for side in ["od", "os"]:
                if side in data and data[side].get("al"):
                    original_eyes.append(side)

            if not original_eyes:
                browser.close()
                return {"error": "Нет данных ПЗО для расчета."}
                
            # ХИТРОСТЬ: Если данных для одного глаза нет, дублируем их из другого, 
            # чтобы форма была 100% заполнена и калькулятор не блокировал кнопку Calculate
            if len(original_eyes) == 1:
                src = original_eyes[0]
                tgt = "os" if src == "od" else "od"
                data[tgt] = data[src].copy()
                
            eyes_to_calc = ["od", "os"] # Заставляем бота всегда заполнять оба глаза

            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            try:
                page.goto("https://www.iolformula.com/", timeout=60000, wait_until="domcontentloaded")
            except Exception as e:
                print(f"[KANE] goto warn: {e}")
            page.wait_for_timeout(4000)

            # --- Пробиваем "I Agree" ---
            print("[KANE] Ищем и нажимаем 'I Agree'...")
            clicked = False
            for frame in [page] + page.frames:
                try:
                    agree = frame.locator("text=/i agree/i").first
                    if agree.is_visible(timeout=1000):
                        agree.click(force=True)
                        clicked = True
                        break
                except: pass
            if not clicked:
                for frame in [page] + page.frames:
                    try:
                        res = frame.evaluate("() => { let els = Array.from(document.querySelectorAll('button, a, div, span')); let btn = els.find(e => e.innerText && e.innerText.trim().toLowerCase() === 'i agree'); if (btn) { btn.click(); return true; } return false; }")
                        if res:
                            clicked = True
                            break
                    except: pass
            
            page.wait_for_timeout(2000)
            
            calc_frame = None
            print("[KANE] Ждем форму калькулятора...")
            for _ in range(15):
                for frame in [page] + page.frames:
                    try:
                        if frame.locator("#Patient").count() > 0:
                            calc_frame = frame
                            break
                    except: pass
                if calc_frame: break
                page.wait_for_timeout(1000)
                
            if not calc_frame:
                browser.close()
                return {"error": "Не найдена форма калькулятора Kane (тайм-аут)."}
            
            if is_toric:
                print("[KANE] Ищем переход в Toric Calculator...")
                for frame in [page] + page.frames:
                    try:
                        btns = frame.locator("text='Toric'").element_handles()
                        for btn in btns:
                            if btn.is_visible():
                                btn.click()
                                page.wait_for_timeout(500)
                    except: pass
                
                print("[KANE] Ждем отрисовки торических полей...")
                try:
                    if "od" in eyes_to_calc: calc_frame.wait_for_selector("#al-right-t", timeout=5000)
                    elif "os" in eyes_to_calc: calc_frame.wait_for_selector("#al-left-t", timeout=5000)
                except: pass
                page.wait_for_timeout(1000)

                print("[KANE] Заполняем SIA и Incision...")
                for frame in [page] + page.frames:
                    try:
                        frame.evaluate(f"""() => {{
                            let inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
                            inputs.forEach(inp => {{
                                let ctx = ((inp.parentElement ? inp.parentElement.innerText : '') + ' ' + inp.id + ' ' + inp.name).toLowerCase();
                                if (ctx.includes('sia')) {{ inp.value = '{sia}'; inp.dispatchEvent(new Event('input', {{bubbles: true}})); }}
                                if (ctx.includes('incision') || ctx.includes('inc')) {{ inp.value = '{incision}'; inp.dispatchEvent(new Event('input', {{bubbles: true}})); }}
                            }});
                        }}""")
                    except: pass
                page.wait_for_timeout(1000)

            first_eye_data = data[original_eyes[0]]
            raw_sex = str(first_eye_data.get("sex", "")).strip().lower()
            sex_label = "F" if raw_sex in ("ж", "f", "female", "жен") else "M"
            
            print("[KANE] Выбираем пол и заполняем хирурга...")
            for frame in [page] + page.frames:
                try:
                    frame.locator(f'label:has-text("{sex_label}")').first.click(timeout=1000)
                    try: frame.locator("#Surgeon").fill("MedEye")
                    except: pass
                    break
                except: pass
            page.wait_for_timeout(500)

            if "od" in eyes_to_calc:
                print("[KANE] Заполняем OD...")
                d_od = data["od"]
                for frame in [page] + page.frames:
                    try:
                        if frame.locator("#Patient").count() > 0:
                            frame.locator("#Patient").fill(str(pat_name))
                            frame.locator("#A-Constant1").fill(str(d_od.get("a_const", "")))
                            frame.locator("#right-target").fill(str(d_od.get("target", "0")))
                            if is_toric:
                                frame.locator("#al-right-t").fill(str(d_od.get("al", "")))
                                frame.locator("#k1-right-t").fill(str(d_od.get("k1", "")))
                                frame.locator("#k1-right-t-axis").fill(str(d_od.get("k1_ax", "")))
                                frame.locator("#k2-right-t").fill(str(d_od.get("k2", "")))
                                if d_od.get("acd"): frame.locator("#acd-right-t").fill(str(d_od.get("acd", "")))
                            else:
                                frame.locator("#al-right").fill(str(d_od.get("al", "")))
                                frame.locator("#k1-right").fill(str(d_od.get("k1", "")))
                                frame.locator("#k2-right").fill(str(d_od.get("k2", "")))
                                if d_od.get("acd"): frame.locator("#acd-right").fill(str(d_od.get("acd", "")))
                            break
                    except: pass

            if "os" in eyes_to_calc:
                print("[KANE] Заполняем OS...")
                d_os = data["os"]
                for frame in [page] + page.frames:
                    try:
                        if frame.locator("#Patient").count() > 0:
                            frame.locator("#Patient").fill(str(pat_name))
                            frame.locator("#A-Constant2").fill(str(d_os.get("a_const", "")))
                            frame.locator("#left-target").fill(str(d_os.get("target", "0")))
                            if is_toric:
                                frame.locator("#al-left-t").fill(str(d_os.get("al", "")))
                                frame.locator("#k1-left-t").fill(str(d_os.get("k1", "")))
                                frame.locator("#k1-left-t-axis").fill(str(d_os.get("k1_ax", "")))
                                frame.locator("#k2-left-t").fill(str(d_os.get("k2", "")))
                                if d_os.get("acd"): frame.locator("#acd-left-t").fill(str(d_os.get("acd", "")))
                            else:
                                frame.locator("#al-left").fill(str(d_os.get("al", "")))
                                frame.locator("#k1-left").fill(str(d_os.get("k1", "")))
                                frame.locator("#k2-left").fill(str(d_os.get("k2", "")))
                                if d_os.get("acd"): frame.locator("#acd-left").fill(str(d_os.get("acd", "")))
                            break
                    except: pass

            # Перехватываем AJAX-ответ API напрямую (вместо парсинга DOM-таблиц)
            print(f"[KANE] Жду ответа API для {original_eyes}...")
            
            try:
                page.screenshot(path="kane_before_calc.png", full_page=True)
                print("[KANE] 📸 Скриншот перед кликом сохранен в файл kane_before_calc.png")
            except: pass

            def is_kane_api_response(response):
                return (response.request.method == "POST" and
                        "iolformula.com/api/" in response.url and
                        "jx.js" not in response.url)

            try:
                with page.expect_response(is_kane_api_response, timeout=45000) as resp_info:
                    calc_btn = calc_frame.locator("input.calculate").first
                    calc_btn.scroll_into_view_if_needed()
                    page.wait_for_timeout(500)
                    # Используем более надежный клик, который сработает даже если кнопка частично перекрыта
                    box = calc_btn.bounding_box()
                    if box:
                        calc_btn.click(force=True, position={'x': box['width'] / 2, 'y': box['height'] / 2})
                    else:
                        calc_btn.click(force=True)

                kane_response = resp_info.value
                body = kane_response.text()
                print(f"[KANE] Ответ API: {body[:300]}")

                resp_data = json_lib.loads(body)

                # Формат ответа: [["vr","code",0],["vr","res",{...eye data...}],["vr","report","hash"]]
                eye_data = None
                for item in resp_data:
                    if isinstance(item, list) and len(item) >= 3 and item[1] == "res":
                        eye_data = item[2]
                        break

                if not eye_data:
                    for side in original_eyes:
                        out[side] = {"error": "Kane API не вернул данные (нет 'res' в ответе)."}
                else:
                    for side in ["od", "os"]:
                        if side not in original_eyes:
                            continue
                        eye_key = "eye1" if side == "od" else "eye2"
                        eye_result = eye_data.get(eye_key, {})
                        data_rows = eye_result.get("data", [])

                        if not data_rows:
                            out[side] = {"error": "Kane: нет данных для этого глаза."}
                            continue

                        # data_rows: [[power, refraction], ...]
                        tbl = [{"power": round(float(row[0]), 2), "ref": round(float(row[1]), 2)}
                               for row in data_rows if len(row) >= 2]
                        tbl.sort(key=lambda x: x["power"], reverse=True)

                        toric_table = []
                        best_cyl = None
                        if is_toric:
                            # data2: [[cyl_power, residual_cyl, axis], ...]
                            toric_rows = eye_result.get("data2", [])
                            # data_ch: recommended cylinder [[cyl_power]]
                            data_ch = eye_result.get("data_ch", [[]])
                            if data_ch and data_ch[0]:
                                try: best_cyl = round(float(data_ch[0][0]), 2)
                                except: pass
                            if toric_rows:
                                try:
                                    for row in toric_rows:
                                        if len(row) >= 3:
                                            toric_table.append({
                                                "cyl_power": round(float(row[0]), 2),
                                                "residual_cyl": round(float(row[1]), 2),
                                                "axis": round(float(row[2]), 1)
                                            })
                                except Exception as e:
                                    print(f"[KANE] Ошибка парсинга торической таблицы: {e}")

                        if tbl:
                            target = float(data[side].get("target", 0.0))
                            em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                            result_payload = {"p_emmetropia": em_row["power"], "table": tbl}
                            if toric_table:
                                result_payload["toric_table"] = toric_table
                                result_payload["best_cyl"] = best_cyl
                            out[side] = result_payload
                            print(f"  -> {side.upper()} успешно: p_em={em_row['power']}, ref={em_row['ref']}")
                        else:
                            out[side] = {"error": "Kane: пустая таблица."}

            except Exception as e:
                print(f"[KANE] Ошибка при получении ответа API: {e}")
                for side in original_eyes:
                    out[side] = {"error": f"Kane: тайм-аут или ошибка ({str(e)[:100]})."}

            browser.close()

        if not out: return {"error": "Сайт не вернул результаты ни для одного глаза."}
        return {"result": out}
    except Exception as e:
        return {"error": f"Ошибка Playwright (Kane): {str(e)}"}

def alpins_vector_analysis(pre_c_minus: float, pre_a: float, post_c_minus: float, post_a: float, target_c_minus: float = 0.0, target_a: float = 0.0) -> Dict[str, float]:
    """
    Векторный анализ астигматизма по методу Alpins.
    Возвращает: TIA, SIA, DV (в диоптриях и осях), а также индексы ME, AE и CI.
    """
    # Alpins работает с плюс-цилиндрами (стимулирующий меридиан)
    def to_plus_cyl(c, a):
        if c > 0: return c, a
        new_a = (a + 90) % 180
        if new_a == 0: new_a = 180
        return -c, new_a

    pre_cp, pre_ap = to_plus_cyl(pre_c_minus, pre_a)
    post_cp, post_ap = to_plus_cyl(post_c_minus, post_a)
    targ_cp, targ_ap = to_plus_cyl(target_c_minus, target_a)

    def to_vec(c, a):
        rad = math.radians(a * 2)
        return c * math.cos(rad), c * math.sin(rad)

    def from_vec(x, y):
        c = math.sqrt(x**2 + y**2)
        a = math.degrees(math.atan2(y, x)) / 2.0
        if a <= 0: a += 180
        if a > 180: a -= 180
        return c, a

    x_pre, y_pre = to_vec(pre_cp, pre_ap)
    x_post, y_post = to_vec(post_cp, post_ap)
    x_targ, y_targ = to_vec(targ_cp, targ_ap)

    x_tia, y_tia = x_targ - x_pre, y_targ - y_pre
    tia_mag, tia_ax = from_vec(x_tia, y_tia)

    x_sia, y_sia = x_post - x_pre, y_post - y_pre
    sia_mag, sia_ax = from_vec(x_sia, y_sia)

    x_dv, y_dv = x_post - x_targ, y_post - y_targ
    dv_mag, dv_ax = from_vec(x_dv, y_dv)

    me = sia_mag - tia_mag
    ci = (sia_mag / tia_mag) if tia_mag > 0.001 else 0.0

    cross = x_tia * y_sia - y_tia * x_sia
    dot = x_tia * x_sia + y_tia * y_sia
    ae = math.degrees(math.atan2(cross, dot)) / 2.0

    return {
        "TIA": round(tia_mag, 2), "TIA_ax": int(round(tia_ax)),
        "SIA": round(sia_mag, 2), "SIA_ax": int(round(sia_ax)),
        "DV": round(dv_mag, 2), "DV_ax": int(round(dv_ax)),
        "ME": round(me, 2), "AE": round(ae, 1), "CI": round(ci, 2)
    }

def scrape_escrs_formula(data: dict) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "Библиотека Playwright не установлена."}
        
    out = {}
    try:
        with sync_playwright() as p:
            import os, re
            ctx_args = {
                "user_agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                "viewport": {'width': 1920, 'height': 1080}
            }
            if os.path.exists("escrs_state.json"):
                ctx_args["storage_state"] = "escrs_state.json"
                
            launch_args = ['--disable-web-security', '--disable-blink-features=AutomationControlled', '--headless=new']
            ext_path = os.path.abspath("capsolver_ext")
            if os.path.exists(ext_path):
                launch_args.append(f"--disable-extensions-except={ext_path}")
                launch_args.append(f"--load-extension={ext_path}")
                
            browser = p.chromium.launch(headless=False, args=launch_args)
            context = browser.new_context(**ctx_args)
            page = context.new_page()
            
            try:
                from playwright_stealth import stealth_sync
                stealth_sync(page)
            except ImportError: pass
            
            eyes_to_calc = [s for s in ["od", "os"] if s in data and data[s].get("al")]
            if not eyes_to_calc:
                browser.close()
                return {"error": "Нет данных ПЗО для расчета."}
                
            page.goto("https://iolcalculator.escrs.org/", timeout=60000, wait_until="networkidle")
            page.wait_for_timeout(3000)
            
            def fill_input(label_text, val, index=0):
                if not val: return
                try:
                    inp = page.get_by_label(re.compile(rf"^{label_text}", re.IGNORECASE)).nth(index)
                    inp.click(force=True, timeout=1000)
                    inp.clear()
                    inp.type(str(val), delay=50) # Печатаем медленнее, как человек
                    inp.press("Tab") 
                    page.wait_for_timeout(50)
                except: pass
            
            pat_name = data.get("patient_name", "Patient")
            if not pat_name or pat_name == "Без имени": pat_name = "Patient"
            fill_input("Surgeon", "MedEye")
            fill_input("Patient Initials", pat_name[:10])
            if data.get("patient_age"):
                fill_input("Age", data["patient_age"])
                
            raw_sex = str(data.get("patient_sex", "")).strip().lower()
            sex_en = "Male" if raw_sex in ("м", "m", "male", "муж") else ("Female" if raw_sex in ("ж", "f", "female", "жен") else "Male")
            try:
                gender = page.get_by_label(re.compile(r"^Gender", re.IGNORECASE)).first
                gender.click(force=True, timeout=1000)
                page.wait_for_timeout(300)
                page.locator(".mud-popover-open .mud-list-item").filter(has_text=sex_en).first.click(timeout=1000)
            except: pass
            
            page.wait_for_timeout(500)
            
            for side in eyes_to_calc:
                idx = 0 if side == "od" else 1
                d = data[side]
                
                fill_input("AL", d.get("al"), idx)
                fill_input("K1", d.get("k1"), idx)
                fill_input("K2", d.get("k2"), idx)
                fill_input("ACD", d.get("acd"), idx)
                fill_input("Target Refraction", str(d.get("target", "0.00")), idx)
                
                try:
                    mfg_inp = page.get_by_label(re.compile(r"^Manufacturer", re.IGNORECASE)).nth(idx)
                    mfg_inp.click(force=True, timeout=1000)
                    page.wait_for_timeout(500)
                    page.locator(".mud-popover-open .mud-list-item").filter(has_text="Alcon").first.click(timeout=1000)
                    page.wait_for_timeout(500)
                    
                    iol_inp = page.get_by_label(re.compile(r"^Select IOL", re.IGNORECASE)).nth(idx)
                    iol_inp.click(force=True, timeout=1000)
                    page.wait_for_timeout(500)
                    page.locator(".mud-popover-open .mud-list-item").nth(1).click(timeout=1000)
                    page.wait_for_timeout(500)
                    
                    ac = str(d.get("a_const", "119.00"))
                    pacd = str(round((float(ac) - 118.0) * 0.5 + 5.0, 2)) if ac != "119.00" else "5.60"
                    
                    fill_input("Barrett A-Constant", ac, idx)
                    fill_input("Cooke A-Constant", ac, idx)
                    fill_input("EVO A-Constant", ac, idx)
                    fill_input("Hill-RBF A-Constant", ac, idx)
                    fill_input("Hoffer", pacd, idx) 
                    fill_input("Kane A-Constant", ac, idx)
                    fill_input("Pearl DGS A-Constant", ac, idx)
                except: pass
                    
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)
            
            try:
                calc_btn = page.locator("button:has-text('CALCULATE'), button:has-text('Calculate')").first
                if not calc_btn.is_disabled():
                    # Очеловечивание: плавно ведем мышку к центру кнопки и кликаем
                    box = calc_btn.bounding_box()
                    if box:
                        import random
                        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=15)
                        page.wait_for_timeout(random.randint(200, 500))
                        page.mouse.down()
                        page.wait_for_timeout(random.randint(50, 150))
                        page.mouse.up()
                    else:
                        calc_btn.click(force=True)
            except: pass
            
            js_extract = """
            () => {
                let tables = [];
                document.querySelectorAll('table').forEach(tbl => {
                    let rows = [];
                    tbl.querySelectorAll('tr').forEach(tr => {
                        let cols = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim().replace(/\\n/g, ' '));
                        if (cols.length > 0) rows.push(cols.join(' | '));
                    });
                    if (rows.length > 0) tables.push(rows);
                });
                return tables;
            }
            """
            
            valid_tables = []
            for _ in range(30):
                page.wait_for_timeout(1000)
                tables = page.evaluate(js_extract)
                if tables:
                    for tbl in tables:
                        if tbl and len(tbl) > 1 and ("SE PWR" in tbl[0] or "IOL" in tbl[0]):
                            if tbl not in valid_tables:
                                valid_tables.append(tbl)
                    if len(valid_tables) >= len(eyes_to_calc):
                        break
            
            if valid_tables:
                for i, side in enumerate(eyes_to_calc):
                    if i < len(valid_tables):
                        tbl = valid_tables[i]
                        headers = tbl[0].split(' | ')
                        formulas = []
                        results = {}
                        for h in headers[1:]:
                            name = h.split(' A:')[0].split(' pACD:')[0].strip()
                            formulas.append(name)
                            results[name] = []
                            
                        for row_str in tbl[1:]:
                            cols = row_str.split(' | ')
                            if not cols[0].strip(): continue
                            try: pwr = float(cols[0].replace('+', '').replace(',', '.'))
                            except: continue
                            
                            for j, f_name in enumerate(formulas):
                                if j + 1 < len(cols):
                                    ref_str = cols[j+1].strip()
                                    if ref_str:
                                        try:
                                            ref = float(ref_str.replace('+', '').replace(',', '.'))
                                            results[f_name].append({"power": pwr, "ref": ref})
                                        except: pass
                        
                        out[side] = {}
                        target = float(data[side].get("target", 0.0))
                        for f_name, data_arr in results.items():
                            if data_arr:
                                data_arr.sort(key=lambda x: x["power"], reverse=True)
                                em_row = min(data_arr, key=lambda x: abs(x["ref"] - target))
                                out[side][f_name] = {"p_emmetropia": em_row["power"], "table": data_arr}
                    else:
                        out[side] = {"error": "Не удалось распарсить таблицу."}
            else:
                for side in eyes_to_calc:
                    out[side] = {"error": "ESCRS не выдал результаты (таймаут)."}
                    
            browser.close()
            return {"result": out}
    except Exception as e:
        return {"error": f"Ошибка Playwright (ESCRS): {str(e)}"}

def scrape_jnj_toric_both(data: dict) -> dict:
    try:
        from playwright.sync_api import sync_playwright
        import re
    except ImportError:
        return {"error": "Библиотека Playwright не установлена."}

    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False, slow_mo=200, args=['--disable-web-security', '--disable-blink-features=AutomationControlled'])
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport={'width': 1280, 'height': 900}
            )
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

            eyes_to_calc = [s for s in ["od", "os"] if s in data and data[s].get("al")]
            if not eyes_to_calc:
                browser.close()
                return {"error": "Нет данных ПЗО для расчета."}

            try:
                page.goto("https://www.tecnistoriccalc.com/", timeout=60000, wait_until="domcontentloaded")
            except Exception:
                pass
            page.wait_for_timeout(3000)

            # Обходим соглашение "I Accept"
            for frame in [page] + page.frames:
                try:
                    frame.evaluate("""() => {
                        let btns = Array.from(document.querySelectorAll('button, a, input'));
                        let agree = btns.find(b => (b.innerText || b.value || '').toLowerCase().includes('accept') || (b.innerText || b.value || '').toLowerCase().includes('agree'));
                        if (agree) agree.click();
                    }""")
                except: pass
            page.wait_for_timeout(2000)

            calc_frame = None
            print("[J&J] Ждем загрузки формы...")
            for _ in range(15):
                for frame in [page] + page.frames:
                    try:
                        if frame.locator("#surgeonName").count() > 0:
                            calc_frame = frame
                            break
                    except: pass
                if calc_frame: break
                page.wait_for_timeout(1000)
                
            if not calc_frame:
                browser.close()
                return {"error": "Форма калькулятора J&J не найдена на странице (тайм-аут)."}

            try:
                calc_frame.locator("text=/select lens/i").first.click(timeout=5000, force=True)
                page.wait_for_timeout(1000)
                page.keyboard.press("ArrowDown")
                page.wait_for_timeout(500)
                page.keyboard.press("Enter")
                page.wait_for_timeout(1500)
            except: pass

            pat_name = data.get("patient_name", "Patient")
            sia = data.get("jnj_sia", 0.2)
            incision = data.get("jnj_incision", 90)

            def type_val(selector, text):
                el = calc_frame.locator(selector)
                el.click(force=True)
                el.fill("")
                el.type(str(text), delay=30)
                el.press("Tab")
                page.wait_for_timeout(100)

            for side in eyes_to_calc:
                d = data[side]
                try:
                    calc_frame.fill("#surgeonName", "MedEye")
                    calc_frame.fill("#patientInfo", str(pat_name))

                    if side == "od":
                        calc_frame.evaluate("document.getElementById('eyeSelection1').click()")
                    else:
                        calc_frame.evaluate("document.getElementById('eyeSelection2').click()")
                    page.wait_for_timeout(500)

                    type_val("#sia", sia)
                    type_val("#incisionLocation", incision)

                    k1 = float(d.get("k1", 0))
                    k2 = float(d.get("k2", 0))
                    k1_ax = float(d.get("k1_ax", 0))

                    type_val("#flatK1", k1)
                    type_val("#flatK1M", int(k1_ax))
                    type_val("#steepK2", k2)

                    calc_frame.locator("#includePCA").check(force=True)
                    calc_frame.locator("#kIndex").select_option(index=1)
                    
                    type_val("#axialLength", d.get("al", ""))

                    try:
                        calc_frame.evaluate("""() => {
                            return new Promise((resolve, reject) => {
                                let attempts = 0;
                                let interval = setInterval(() => {
                                    attempts++;
                                    let sel = document.getElementById('seIOLPower');
                                    if (sel && sel.options && sel.options.length > 1) {
                                        clearInterval(interval);
                                        let targetIdx = Math.floor(sel.options.length / 2);
                                        if (targetIdx === 0) targetIdx = 1;
                                        sel.selectedIndex = targetIdx;
                                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                                        sel.dispatchEvent(new Event('input', { bubbles: true }));
                                        resolve(targetIdx);
                                    } else if (attempts > 40) { // 20 секунд макс
                                        clearInterval(interval);
                                        reject('Таймаут: список диоптрий пуст');
                                    }
                                }, 500);
                            });
                        }""")
                    except: pass
                    
                    calc_frame.evaluate("window.scrollBy(0, 1500)")
                    page.wait_for_timeout(500)

                    # Нажимаем Calculate
                    try:
                        calc_frame.evaluate("""() => {
                            let btns = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], .btn, .button'));
                            let calc = btns.find(b => (b.innerText || b.value || '').toLowerCase().includes('calculate'));
                            if (calc) { calc.click(); return true; }
                            return false;
                        }""")
                    except: pass

                    page.wait_for_timeout(3000)

                    # Парсим результаты таблиц
                    js_extract = """
                    () => {
                        let vt = [];
                        document.querySelectorAll('table').forEach(tbl => {
                            let rows = [];
                            tbl.querySelectorAll('tr').forEach(tr => {
                                let cols = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim());
                                if(cols.length > 0) rows.push(cols);
                            });
                            if(rows.length > 1) vt.push(rows);
                        });
                        return vt;
                    }
                    """
                    tables = calc_frame.evaluate(js_extract)

                    parsed_table = []
                    for tbl in tables:
                        for row in tbl[1:]:
                            nums = []
                            for c in row:
                                matches = re.findall(r'[-+]?\d*\.\d+|[-+]?\d+', c.replace(',', '.'))
                                if matches:
                                    nums.append(float(matches[0]))
                            
                            # Эвристика: если есть хотя бы 2 числа, считаем первое - силой (SE Power), последнее - остаточным астигматизмом
                            if len(nums) >= 2:
                                power = nums[0]
                                ref = nums[-1] if len(nums) > 1 else 0.0
                                if not any(r['power'] == power for r in parsed_table):
                                    parsed_table.append({"power": power, "ref": ref})

                    if parsed_table:
                        parsed_table.sort(key=lambda x: x["power"], reverse=True)
                        target = float(data[side].get("target", 0.0))
                        em_row = min(parsed_table, key=lambda x: abs(x["ref"] - target))
                        out[side] = {
                            "p_emmetropia": em_row["power"],
                            "table": parsed_table
                        }
                    else:
                        out[side] = {"error": "Не удалось распарсить таблицу J&J Toric."}
                except Exception as e:
                     out[side] = {"error": f"Ошибка: {str(e)}"}
                     
            browser.close()
            return {"result": out}
    except Exception as e:
        return {"error": f"Ошибка Playwright (J&J Toric): {str(e)}"}