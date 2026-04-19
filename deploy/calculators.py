import math
import json as json_lib
import re
from typing import Dict, Any, Optional
from playwright.sync_api import sync_playwright
import playwright_stealth

def suggest_flap_diameter(wtw_value: Optional[float]) -> float:
    if wtw_value is None: return 9.0
    if wtw_value < 11.4: return 8.7
    elif wtw_value < 11.8: return 8.8
    elif wtw_value < 12.1: return 8.9
    else: return 9.0

def calculate_lenticule_thickness_smile(sph: float, cyl: float, optical_zone: float) -> float:
    se = abs(sph + (cyl / 2.0))
    return (se * (optical_zone ** 2)) / 3.0

def calculate_ablation_wfo(sph: float, cyl: float, optical_zone: float, k_pre: Optional[float] = None) -> Dict[str, Any]:
    if sph <= 0 and cyl <= 0:
        depth = ((optical_zone ** 2) * abs(sph) / 3.0) * 1.25 + ((optical_zone ** 2) * abs(cyl) / 6.0) * 1.25
    elif sph > 0 and sph + cyl >= 0: depth = 15.0 
    elif sph > 0 and sph + cyl < 0:
        depth = ((optical_zone ** 2) * abs(sph + cyl) / 3.0) * 1.25
    else:
        depth = ((optical_zone ** 2) * abs(sph) / 3.0) * 1.25 + ((optical_zone ** 2) * abs(cyl) / 6.0) * 1.25
    
    result = {"depth": round(depth, 2)}
    if k_pre is not None:
        se = sph + (cyl / 2.0)
        k_post = k_pre + se
        result["k_post"] = round(k_post, 2)
        if k_post < 34.0: result["warning"] = "Роговица < 34D."
        elif k_post > 48.0: result["warning"] = "Роговица > 48D."
    return result

def scrape_barrett_universal2_both(data: dict) -> dict:
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-blink-features=AutomationControlled'])
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
            )
            page = context.new_page()
            
            print(f"[{data.get('formula', 'Barrett')}] Navigating...")
            page.goto("https://calc.apacrs.org/barrett_universal2105/", timeout=60000)
            page.screenshot(path="debug_barrett_start.png")
            
            try: page.locator("input[value*='Agree' i]").first.click(timeout=3000)
            except: pass
            
            page.wait_for_selector("#MainContent_Axlength", timeout=15000)
            page.fill("#MainContent_PatientName", str(data.get("patient_name", "Patient")))
            a = data.get("od", {}).get("a_const") or data.get("os", {}).get("a_const")
            if a: page.fill("#MainContent_Aconstant", str(a))
            
            sides = [s for s in ["od", "os"] if s in data and data[s].get("al")]
            for side in sides:
                sfx = "0" if side == "os" else ""
                page.fill(f"#MainContent_Axlength{sfx}", str(data[side]["al"]))
                page.fill(f"#MainContent_MeasuredK1{sfx}", str(data[side]["k1"]))
                page.fill(f"#MainContent_MeasuredK2{sfx}", str(data[side]["k2"]))
                if data[side].get("acd"): page.fill(f"#MainContent_OpticalACD{sfx}", str(data[side]["acd"]))

            page.evaluate("() => { if(typeof Page_ClientValidate === 'function') window.Page_ClientValidate = () => true; }")
            page.click("#MainContent_Button1")
            page.wait_for_timeout(3000)

            # Click "Universal Formula" tab to show results
            try:
                page.locator("a", has_text="Universal Formula").first.click(timeout=5000)
                page.wait_for_timeout(1000)
            except:
                pass

            valid_tables = []
            for _ in range(40):
                page.wait_for_timeout(300)
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
                        u = [seen.add(x['power']) or x for x in parsed if x['power'] not in seen]
                        valid_tables.append(sorted(u, key=lambda x: x["power"], reverse=True))
                if len(valid_tables) >= len(sides):
                    break

            # Barrett всегда показывает OD первым, OS вторым — даже если OD пустой
            # Если считали только OS — берём последнюю таблицу
            for i, side in enumerate(sides):
                tbl_idx = 1 if side == 'os' and 'od' not in sides else i
                if tbl_idx < len(valid_tables):
                    tbl = valid_tables[tbl_idx]
                    target = float(data[side].get("target", 0.0))
                    em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                    out[side] = {"p_emmetropia": em_row["power"], "table": tbl}
                elif valid_tables:
                    tbl = valid_tables[-1]
                    target = float(data[side].get("target", 0.0))
                    em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                    out[side] = {"p_emmetropia": em_row["power"], "table": tbl}

            browser.close()
            return {"result": out}
    except Exception as e: return {"error": str(e)}

def scrape_kane_formula_both(data: dict) -> dict:
    out = {}
    try:
        with sync_playwright() as p:
            import time, random
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-blink-features=AutomationControlled'])
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
            )
            page = context.new_page()
            playwright_stealth.stealth(page)
            
            print("[Kane] Navigating...")
            page.goto("https://www.iolformula.com/", timeout=60000, wait_until="domcontentloaded")
            page.wait_for_timeout(random.randint(1500, 3000))
            page.screenshot(path="debug_kane_start.png")
            
            # I Agree
            try:
                page.evaluate("""() => {
                    let b = Array.from(document.querySelectorAll('div, button, a')).find(el => el.innerText.trim().toLowerCase() === 'i agree');
                    if (b) b.click();
                }""")
            except: pass

            calc_frame = None
            for _ in range(30):
                for f in [page] + page.frames:
                    if f.locator("#Patient").count() > 0:
                        calc_frame = f; break
                if calc_frame: break
                page.wait_for_timeout(500)
            
            if not calc_frame:
                browser.close(); return {"error": "Calc not found"}

            is_toric = data.get("use_kane_toric", False)
            if is_toric:
                print("[KANE] Enabling Toric mode...")
                page.evaluate("""() => {
                    let t1 = document.querySelector('input[name="toric_1"][value="1"]');
                    if (t1 && !t1.checked) t1.parentElement.click();
                    let t2 = document.querySelector('input[name="toric_2"][value="1"]');
                    if (t2 && !t2.checked) t2.parentElement.click();
                }""")
                page.wait_for_timeout(1500)

            # Demographics
            calc_frame.locator("#Patient").fill(str(data.get("patient_name", "Patient")))
            sex_label = "F" if str(data.get("od", {}).get("sex", "")).lower() in ("ж", "f", "female") else "M"
            page.evaluate(f"() => {{ let l = Array.from(document.querySelectorAll('label')).find(x => x.innerText.trim() === '{sex_label}'); if(l) l.click(); }}")
            
            sia = data.get("kane_sia", 0.2)
            inc = data.get("kane_incision", 90)
            sides = [s for s in ["od", "os"] if s in data and data[s].get("al")]

            for side in ["od", "os"]:
                d = data.get(side, {})
                val_al = str(d.get("al", ""))
                val_k1 = str(d.get("k1", ""))
                val_k2 = str(d.get("k2", ""))
                
                suff = "1" if side == "od" else "2"
                side_label = "right" if side == "od" else "left"
                sfx_f = f"-{side_label}" + ("-t" if is_toric else "")

                fill_js = f"""() => {{
                    const fv = (s, v) => {{
                        let el = document.querySelector(s);
                        if(el && v!=="") {{ 
                           el.value = String(v); 
                           el.dispatchEvent(new Event('input', {{bubbles:true}}));
                           el.dispatchEvent(new Event('change', {{bubbles:true}}));
                           el.dispatchEvent(new Event('blur', {{bubbles:true}}));
                        }}
                    }};
                    fv('#A-Constant{suff}', '{d.get("a_const", "118.8")}');
                    fv('#{side_label}-target', '{d.get("target", "0")}');
                    fv('#al{sfx_f}', '{val_al}');
                    fv('#k1{sfx_f}', '{val_k1}');
                    fv('#k2{sfx_f}', '{val_k2}');
                    fv('#acd{sfx_f}', '{d.get("acd", "")}');
                    if({str(is_toric).lower()}) {{
                        fv('#k1{sfx_f}-axis', '{d.get("k1_ax", "0")}');
                        fv('#sia-{side_label}', '{sia}');
                        fv('#inc-{side_label}', '{inc}');
                    }}
                }}"""
                calc_frame.evaluate(fill_js)

            page.wait_for_timeout(random.randint(2000, 4000))
            print("[KANE] Нажимаем Calculate...")

            def is_api(r): return ("iolformula.com/wp-admin/admin-ajax.php" in r.url or "iolformula.com/api/" in r.url) and r.method == "POST"
            try:
                # Эмуляция движения мыши к кнопке
                page.mouse.move(random.randint(100, 500), random.randint(100, 500))
                
                with page.expect_response(is_api, timeout=45000) as resp_info:
                    page.evaluate("() => { const btn = document.querySelector('input.calculate'); if(btn) btn.click(); }")

                resp_body = resp_info.value.text()
                raw_data = json_lib.loads(resp_body)

                eye_data_bundle = None
                if isinstance(raw_data, list):
                    for item in raw_data:
                        if isinstance(item, list) and len(item) >= 3 and item[1] == "res":
                            eye_data_bundle = item[2]
                            break
                elif isinstance(raw_data, dict):
                    eye_data_bundle = raw_data.get("data") or raw_data

                if not eye_data_bundle:
                    return {"error": f"Kane: нет данных в ответе. Raw: {resp_body[:200]}"}

                for side in sides:
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
                return {"error": f"Kane: {e}"}

            browser.close()
            return {"result": out}

            browser.close()
            return {"result": out}
    except Exception as e: return {"error": str(e)}

def scrape_barrett_toric_both(data: dict) -> dict: return {"error": "Not implemented"}
def alpins_vector_analysis(*args) -> dict: return {"error": "Not implemented"}
def scrape_jnj_toric_both(data: dict) -> dict: return {"error": "Not implemented"}