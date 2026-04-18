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
    se = abs(sph + (cyl / 2.0))
    depth = (se * (optical_zone ** 2)) / 3.0
    return depth

def calculate_ablation_wfo(sph: float, cyl: float, optical_zone: float, k_pre: Optional[float] = None) -> Dict[str, Any]:
    if sph <= 0 and cyl <= 0:
        depth = ((optical_zone ** 2) * abs(sph) / 3.0) * 1.25 + ((optical_zone ** 2) * abs(cyl) / 6.0) * 1.25
    elif sph > 0 and sph + cyl >= 0:
        depth = 15.0 
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
    try:
        k = (k1 + k2) / 2.0
        r = 337.5 / k
        lcor = al if al <= 24.2 else -3.446 + 1.716 * al - 0.0237 * (al ** 2)
        cw = -5.41 + 0.58412 * lcor + 0.098 * k
        val = (r ** 2) - ((cw ** 2) / 4.0)
        h = r - math.sqrt(val if val > 0 else 0)
        acd_est = h + 0.62467 * a_const - 68.747 - 3.336
        n, nc = 1.336, 0.333
        p_em = (1000 * n * (n * r - nc * lcor)) / ((lcor - acd_est) * (n * r - nc * acd_est))
        r_factor = 1.35 if al > 25.0 else 1.15 if al < 22.0 else 1.25
        base_p = round(p_em * 2) / 2.0
        table = [{"power": base_p + step, "ref": (p_em - (base_p + step)) / r_factor} for step in [1.5, 1.0, 0.5, 0.0, -0.5, -1.0, -1.5]]
        return {"p_emmetropia": round(p_em, 2), "table": table}
    except Exception as e:
        return {"error": str(e)}

def scrape_barrett_universal2_both(data: dict) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "Библиотека Playwright не установлена."}
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            context = browser.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            page = context.new_page()
            page.goto("https://calc.apacrs.org/barrett_universal2105/", timeout=45000)
            try:
                page.locator("input[value*='Agree' i]").first.click(timeout=3000)
            except: pass
            
            page.wait_for_selector("#MainContent_Axlength", timeout=15000)
            pat_name = data.get("patient_name", "Patient")
            page.fill("#MainContent_PatientName", str(pat_name))
            a_const = data.get("od", {}).get("a_const") or data.get("os", {}).get("a_const")
            if a_const: page.fill("#MainContent_Aconstant", str(a_const))
            
            eyes_processed = []
            for side in ["od", "os"]:
                if side in data and data[side].get("al"):
                    eyes_processed.append(side)
                    suffix = "0" if side == "os" else ""
                    page.fill(f"#MainContent_Axlength{suffix}", str(data[side]["al"]))
                    page.fill(f"#MainContent_MeasuredK1{suffix}", str(data[side]["k1"]))
                    page.fill(f"#MainContent_MeasuredK2{suffix}", str(data[side]["k2"]))
                    if data[side].get("acd"): page.fill(f"#MainContent_OpticalACD{suffix}", str(data[side]["acd"]))

            with page.expect_navigation(timeout=10000):
                page.click("#MainContent_Button1")
            
            valid_tables = []
            for _ in range(30):
                page.wait_for_timeout(200)
                raw_tables = page.evaluate("""() => {
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
                }""")
                valid_tables = []
                for tbl in raw_tables:
                    parsed = []
                    for r in tbl:
                        nums = [float(m) for m in re.findall(r'[-+]?\d*\.\d+|[-+]?\d+', " ".join(r).replace(',','.'))]
                        if len(nums) >= 2:
                            for j in range(len(nums)-1):
                                if 5 <= nums[j] <= 40 and -10 <= nums[j+1] <= 10:
                                    parsed.append({"power": nums[j], "ref": nums[j+1]})
                                    break
                    if len(parsed) >= 3:
                        seen = set()
                        unique = [seen.add(x['power']) or x for x in parsed if x['power'] not in seen]
                        valid_tables.append(sorted(unique, key=lambda x: x["power"], reverse=True))
                if len(valid_tables) >= len(eyes_processed): break

            for i, side in enumerate(eyes_processed):
                if i < len(valid_tables):
                    tbl = valid_tables[i]
                    target = float(data[side].get("target", 0.0))
                    em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                    out[side] = {"p_emmetropia": em_row["power"], "table": tbl}
                else:
                    out[side] = {"error": "Таблица не распарсилась."}
            browser.close()
            return {"result": out}
    except Exception as e:
        return {"error": f"Ошибка Barrett: {str(e)}"}

def scrape_barrett_toric_both(data: dict) -> dict:
    # Аналогичный скрейпинг для Barrett Toric
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "Библиотека Playwright не установлена."}
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            context = browser.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            page = context.new_page()
            page.goto("https://calc.apacrs.org/barrett_toric105/", timeout=30000)
            try: page.locator("input[value*='Agree' i]").first.click(timeout=3000)
            except: pass
            
            page.wait_for_selector("#MainContent_Axlength", timeout=15000)
            pat_name = data.get("patient_name", "Patient")
            page.fill("#MainContent_PatientName", str(pat_name))
            a_const = data.get("od", {}).get("a_const") or data.get("os", {}).get("a_const")
            if a_const: page.fill("#MainContent_Aconstant", str(a_const))
            
            sia = data.get("kane_sia", 0.2)
            inc = data.get("kane_incision", 90)
            page.fill("#MainContent_IncisionLocation", str(inc))
            page.fill("#MainContent_Sia", str(sia))

            eyes_processed = []
            for side in ["od", "os"]:
                if side in data and data[side].get("al"):
                    eyes_processed.append(side)
                    suffix = "0" if side == "os" else ""
                    page.fill(f"#MainContent_Axlength{suffix}", str(data[side]["al"]))
                    page.fill(f"#MainContent_MeasuredK1{suffix}", str(data[side]["k1"]))
                    page.fill(f"#MainContent_MeasuredK2{suffix}", str(data[side]["k2"]))
                    page.fill(f"#MainContent_K1Axis{suffix}", str(data[side].get("k1_ax", 0)))
                    if data[side].get("acd"): page.fill(f"#MainContent_OpticalACD{suffix}", str(data[side]["acd"]))

            with page.expect_navigation(timeout=10000):
                page.click("#MainContent_Button1")
            
            page.wait_for_timeout(3000)
            # В Barrett Toric результаты в сложных таблицах, упрощенный парсинг для MVP
            # Мы вернем Barrett Toric через Calc API клинику если нужно будет
            browser.close()
            return {"result": {}} 
    except Exception as e:
        return {"error": f"Ошибка Barrett Toric: {str(e)}"}

def scrape_kane_formula_both(data: dict) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "Playwright не установлен."}

    out = {}
    try:
        with sync_playwright() as p:
            import builtins
            browser = p.chromium.launch(
                headless=getattr(builtins, 'PLAYWRIGHT_HEADLESS', True),
                args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-blink-features=AutomationControlled']
            )
            import os, json as json_lib
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport={'width': 1280, 'height': 800}
            )

            pat_name = data.get("patient_name", "Patient")
            is_toric = data.get("use_kane_toric", False)
            sia = data.get("kane_sia", 0.2)
            incision = data.get("kane_incision", 90)

            original_eyes = [s for s in ["od", "os"] if s in data and data[s].get("al")]
            if not original_eyes:
                browser.close()
                return {"error": "Нет данных ПЗО."}
            
            # Дубликат для одного глаза
            if len(original_eyes) == 1:
                src = original_eyes[0]
                tgt = "os" if src == "od" else "od"
                data[tgt] = data[src].copy()
            
            eyes_to_calc = ["od", "os"]
            page = context.new_page()
            page.goto("https://www.iolformula.com/", timeout=60000)

            # --- I AGREE ---
            print("[KANE] Пробиваем I Agree...")
            for frame in [page] + page.frames:
                try:
                    page.evaluate("""() => {
                        let btn = Array.from(document.querySelectorAll('div, button, a')).find(el => el.innerText.trim().toLowerCase() === 'i agree');
                        if (btn) btn.click();
                    }""")
                except: pass

            # --- Ждем форму ---
            calc_frame = None
            for _ in range(30):
                for frame in [page] + page.frames:
                    if frame.locator("#Patient").count() > 0:
                        calc_frame = frame
                        break
                if calc_frame: break
                page.wait_for_timeout(200)
            
            if not calc_frame:
                browser.close()
                return {"error": "Тайм-аут загрузки калькулятора."}

            # --- Переключаем режим ---
            if is_toric:
                print("[KANE] Включаем Toric для обоих глаз (глубокий клик)...")
                try:
                    page.evaluate("""() => {
                        let t1 = document.querySelector('input[name="toric_1"][value="1"]');
                        if (t1 && t1.parentElement) t1.parentElement.click();
                        
                        let t2 = document.querySelector('input[name="toric_2"][value="1"]');
                        if (t2 && t2.parentElement) t2.parentElement.click();
                    }""")
                    page.wait_for_timeout(1500)
                    calc_frame.locator("#al-right-t").wait_for(state="attached", timeout=10000)
                    print("[KANE] Торические поля присутствуют в DOM")
                except Exception as e:
                    print(f"[KANE] Ошибка перехода в Toric: {e}")
            else:
                try:
                    page.evaluate("""() => {
                        let t1 = document.querySelector('input[name="nontoric_1"][value="1"]');
                        if (t1 && t1.parentElement) t1.parentElement.click();
                        let t2 = document.querySelector('input[name="nontoric_2"][value="1"]');
                        if (t2 && t2.parentElement) t2.parentElement.click();
                    }""")
                except: pass

            # --- Заполняем ---
            first_eye_data = data[original_eyes[0]]
            raw_sex = str(first_eye_data.get("sex", "")).lower()
            sex_label = "F" if raw_sex in ("ж", "f", "female") else "M"
            try:
                calc_frame.locator("#Patient").fill(str(pat_name))
                page.evaluate(f"() => {{ let l = Array.from(document.querySelectorAll('label')).find(x => x.innerText.trim() === '{sex_label}'); if(l) l.click(); }}")
            except: pass
            
            sia = data.get("kane_sia", 0.2)
            incision = data.get("kane_incision", 90)

            for side in eyes_to_calc:
                d = data.get(side, {})
                suff = "1" if side == "od" else "2"
                side_label = "right" if side == "od" else "left"
                side_suff = f"-{side_label}"
                if is_toric: side_suff += "-t"
                
                print(f"[KANE] Попытка заполнить {side} на основе React-прототипов...")
                try:
                    fill_js = f"""() => {{
                        const fillVal = (selector, val) => {{
                            let el = document.querySelector(selector);
                            if(el && val !== "" && val !== null) {{
                                el.value = String(val);
                                el.dispatchEvent(new Event('input', {{bubbles: true}}));
                                el.dispatchEvent(new Event('change', {{bubbles: true}}));
                            }}
                        }};

                        fillVal('#A-Constant{suff}', '{d.get("a_const", "118.8")}');
                        fillVal('#{side_label}-target', '{d.get("target", "0")}');
                        fillVal('#al{side_suff}', '{d.get("al", "")}');
                        fillVal('#k1{side_suff}', '{d.get("k1", "")}');
                        fillVal('#k2{side_suff}', '{d.get("k2", "")}');
                        fillVal('#acd{side_suff}', '{d.get("acd", "")}');
                        
                        if({str(is_toric).lower()}) {{
                            fillVal('#k1{side_suff}-axis', '{d.get("k1_ax", "0")}');
                            fillVal('#sia-' + '{side_label}', '{sia}');
                            fillVal('#inc-' + '{side_label}', '{incision}');
                        }}
                    }}"""
                    calc_frame.evaluate(fill_js)

                    # Имитируем реальный ввод в одно поле, чтобы сайт "проснулся"
                    try:
                        target_field = calc_frame.locator(f"#{side_label}-target")
                        target_field.focus()
                        page.keyboard.press("End")
                        page.keyboard.type(" ")
                        page.keyboard.press("Backspace")
                    except: pass
                    
                except Exception as e:
                    print(f"[KANE] Ошибка заполнения {side}: {e}")
                
                page.wait_for_timeout(500)

            # Даем сайту 1 секунду на синхронизацию внутреннего состояния (React/Vue)
            page.wait_for_timeout(1000)

            # --- Клик Calculate + API intercept ---
            print("[KANE] Нажимаем Calculate...")
            try:
                def is_api(r): return ("iolformula.com/wp-admin/admin-ajax.php" in r.url or "iolformula.com/api/" in r.url) and r.method == "POST"
                with page.expect_response(is_api, timeout=90000) as resp_info:
                    page.evaluate("() => document.querySelector('input.calculate').click()")

                resp_body = resp_info.value.text()
                raw_data = json_lib.loads(resp_body)

                eye_data_bundle = None
                # Формат 1: список [[..., "res", {...}], ...]
                if isinstance(raw_data, list):
                    for item in raw_data:
                        if isinstance(item, list) and len(item) >= 3 and item[1] == "res":
                            eye_data_bundle = item[2]
                            break
                # Формат 2: {"data": {"eye1": {...}, "eye2": {...}}}
                elif isinstance(raw_data, dict):
                    eye_data_bundle = raw_data.get("data") or raw_data

                if not eye_data_bundle:
                    return {"error": f"API не вернул результат. Raw: {resp_body[:200]}"}

                for side in original_eyes:
                    eye_key = "eye1" if side == "od" else "eye2"
                    eye_res = eye_data_bundle.get(eye_key, {})
                    rows = eye_res.get("data", [])
                    if not rows: continue
                    
                    tbl = [{"power": float(r[0]), "ref": float(r[1])} for r in rows]
                    tbl.sort(key=lambda x: x["power"], reverse=True)
                    target = float(data[side].get("target", 0.0))
                    em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                    
                    out_eye = {"p_emmetropia": em_row["power"], "table": tbl}
                    
                    if is_toric:
                        t_rows = eye_res.get("data2", [])
                        rec_cyl = eye_res.get("data_ch", [[]])
                        if rec_cyl and rec_cyl[0]: out_eye["best_cyl"] = float(rec_cyl[0][0])
                        out_eye["toric_table"] = [
                            {"cyl_power": float(r[0]), "residual_cyl": float(r[1]), "axis": float(r[2])}
                            for r in t_rows if len(r) >= 3
                        ]
                    out[side] = out_eye

            except Exception as e:
                print(f"[KANE] Error: {e}")
                return {"error": str(e)}

            browser.close()
            return {"result": out}
    except Exception as e:
        return {"error": str(e)}

def alpins_vector_analysis(pre_c_minus: float, pre_a: float, post_c_minus: float, post_a: float, target_c_minus: float = 0.0, target_a: float = 0.0) -> Dict[str, float]:
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
    # MVP для ESCRS
    return {"error": "ESCRS Formula temporary unavailable."}

def scrape_jnj_toric_both(data: dict) -> dict:
    return {"error": "J&J Toric Calculator is temporarily unavailable."}