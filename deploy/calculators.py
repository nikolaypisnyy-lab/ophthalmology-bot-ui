import math
import json as json_lib
import re
import random
import time
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
            
            try: page.locator("input[value*='Agree' i]").first.click(timeout=3000)
            except: pass
            
            page.wait_for_selector("#MainContent_Axlength", timeout=15000)
            
            # Use press_sequentially for human-like input
            print(f"[{data.get('formula', 'Barrett')}] Typing patient name...")
            page.locator("#MainContent_PatientName").press_sequentially(str(data.get("patient_name", "Patient")), delay=random.randint(50, 100))
            
            a_const = data.get("od", {}).get("a_const") or data.get("os", {}).get("a_const")
            if a_const: 
                page.locator("#MainContent_Aconstant").press_sequentially(str(a_const), delay=random.randint(50, 100))
            
            sides = [s for s in ["od", "os"] if s in data and data[s].get("al")]
            for side in sides:
                sfx = "0" if side == "os" else ""
                page.locator(f"#MainContent_Axlength{sfx}").press_sequentially(str(data[side]["al"]), delay=random.randint(50, 100))
                page.locator(f"#MainContent_MeasuredK1{sfx}").press_sequentially(str(data[side]["k1"]), delay=random.randint(50, 100))
                page.locator(f"#MainContent_MeasuredK2{sfx}").press_sequentially(str(data[side]["k2"]), delay=random.randint(50, 100))
                if data[side].get("acd"): 
                    page.locator(f"#MainContent_OpticalACD{sfx}").press_sequentially(str(data[side]["acd"]), delay=random.randint(50, 100))

            page.evaluate("() => { if(typeof Page_ClientValidate === 'function') window.Page_ClientValidate = () => true; }")
            print(f"[{data.get('formula', 'Barrett')}] Clicking Calculate...")
            page.click("#MainContent_Button1")
            
            # Ожидание перехода на вкладку результатов
            page.wait_for_timeout(3000)
            try:
                print(f"[{data.get('formula', 'Barrett')}] Clicking Universal Formula tab...")
                page.locator("a", has_text="Universal Formula").first.click(timeout=7000)
                page.wait_for_timeout(2000)
            except Exception as te:
                print(f"[{data.get('formula', 'Barrett')}] Warning: Could not click Universal Formula tab: {te}")

            valid_tables = []
            print(f"[{data.get('formula', 'Barrett')}] Awaiting results table...")
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
                if len(valid_tables) >= len(sides): break

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
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-blink-features=AutomationControlled'])
            # Use a more common Windows User Agent
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                viewport={'width': 1366, 'height': 768},
                device_scale_factor=1,
            )
            page = context.new_page()
            
            # Additional Webdriver detection masking at JS level
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            try:
                playwright_stealth.stealth.stealth_sync(page)
            except:
                try: playwright_stealth.stealth(page)
                except: pass
            
            print("[Kane] Navigating...")
            # Use 'networkidle' to ensure Cloudflare checks completion
            page.goto("https://www.iolformula.com/", timeout=60000, wait_until="networkidle")
            page.wait_for_timeout(random.randint(5000, 7000)) # Human-like wait
            
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
                page.screenshot(path="/root/app/backups/kane_init_error.png")
                browser.close(); return {"error": "Calc not found (Screenshot saved)"}

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

            # Human-like typing for Demographics
            print("[KANE] Typing patient name...")
            calc_frame.locator("#Patient").press_sequentially(str(data.get("patient_name", "Patient")), delay=random.randint(50, 150))
            sex_val = str(data.get("od", {}).get("sex", "")).lower() or str(data.get("os", {}).get("sex", "")).lower()
            sex_label = "F" if sex_val in ("ж", "f", "female") else "M"
            print(f"[KANE] Selecting Sex: {sex_label}")
            page.evaluate(f"""() => {{
                let label = Array.from(document.querySelectorAll('label')).find(x => x.innerText.trim() === '{sex_label}');
                if (label) {{
                    label.click();
                    let input = label.querySelector('input') || document.querySelector('input[value="' + ("{sex_label}" === "F" ? "2" : "1") + '"]');
                    if (input) {{ input.checked = true; input.click(); }}
                }}
            }}""")
            
            sia = data.get("kane_sia", 0.2)
            inc = data.get("kane_incision", 90)
            sides = [s for s in ["od", "os"] if s in data and data[s].get("al")]

            for side in ["od", "os"]:
                d = data.get(side, {})
                val_al = str(d.get("al", ""))
                val_k1 = str(d.get("k1", ""))
                val_k2 = str(d.get("k2", ""))
                
                side_label = "right" if side == "od" else "left"
                sfx_f = f"-{side_label}" + ("-t" if is_toric else "")
                suff = "1" if side == "od" else "2"

                # Typing numerical fields
                if val_al: calc_frame.locator(f"#al{sfx_f}").press_sequentially(val_al, delay=random.randint(50, 100))
                if val_k1: calc_frame.locator(f"#k1{sfx_f}").press_sequentially(val_k1, delay=random.randint(50, 100))
                if val_k2: calc_frame.locator(f"#k2{sfx_f}").press_sequentially(val_k2, delay=random.randint(50, 100))
                
                acd = str(d.get("acd", ""))
                if acd: calc_frame.locator(f"#acd{sfx_f}").press_sequentially(acd, delay=random.randint(50, 100))
                
                target = str(d.get("target", "0"))
                if target: calc_frame.locator(f"#{side_label}-target").press_sequentially(target, delay=random.randint(50, 100))
                
                a_const = str(d.get("a_const", "118.8"))
                if a_const: calc_frame.locator(f"#A-Constant{suff}").press_sequentially(a_const, delay=random.randint(50, 100))

                if is_toric:
                    axis = str(d.get("k1_ax", "0"))
                    if axis: calc_frame.locator(f"#k1{sfx_f}-axis").press_sequentially(axis, delay=random.randint(50, 100))
                    
                    sia_val = str(sia)
                    if sia_val: calc_frame.locator(f"#sia-{side_label}").press_sequentially(sia_val, delay=random.randint(50, 100))
                    
                    inc_val = str(inc)
                    if inc_val: calc_frame.locator(f"#inc-{side_label}").press_sequentially(inc_val, delay=random.randint(50, 100))

            page.wait_for_timeout(random.randint(3000, 5000))
            print("[KANE] Нажимаем Calculate...")
            # Human-like interaction: mouse move + element specific click
            page.mouse.move(random.randint(100, 500), random.randint(100, 500))
            page.evaluate("() => { const btn = document.querySelector('input.calculate'); if(btn) btn.click(); }")

            # Ждем появления результатов
            print("[KANE] Ожидание результатов на странице...")
            try:
                page.wait_for_selector(".results-table, .eye-res, .res-row", timeout=45000)
                page.wait_for_timeout(3000)
            except Exception as fe:
                page.screenshot(path="/root/app/backups/kane_last_error.png")
                browser.close()
                return {"error": f"Kane: результаты не появились. См. скриншот. Err: {fe}"}

            results_data = page.evaluate("""() => {
                const parseEye = (eyeNum) => {
                    let res = [];
                    let container = document.querySelector(`#eye${eyeNum}`);
                    if (!container) return { data: [] };
                    
                    container.querySelectorAll('.res-row').forEach(row => {
                        let p = row.querySelector('.res-p')?.innerText;
                        let r = row.querySelector('.res-ref')?.innerText;
                        if (p && r) res.push([parseFloat(p.replace(/[^0-9.-]/g, '')), parseFloat(r.replace(/[^0-9.-]/g, ''))]);
                    });

                    let t_res = [];
                    container.querySelectorAll('.toric-res-row').forEach(row => {
                        let cells = row.querySelectorAll('div');
                        if (cells.length >= 3) {
                            t_res.push([
                                parseFloat(cells[0].innerText.replace(/[^0-9.-]/g, '')), 
                                parseFloat(cells[1].innerText.replace(/[^0-9.-]/g, '')),
                                parseFloat(cells[2].innerText.replace(/[^0-9.-]/g, ''))
                            ]);
                        }
                    });

                    let best_cyl = container.querySelector('.recommended-cyl')?.innerText || "";
                    return { data: res, data2: t_res, best_cyl: best_cyl };
                };
                return { eye1: parseEye(1), eye2: parseEye(2) };
            }""")

            for side in sides:
                eye_key = "eye1" if side == "od" else "eye2"
                eye_res = results_data.get(eye_key, {})
                rows = eye_res.get("data", [])
                if not rows: continue

                tbl = [{"power": r[0], "ref": r[1]} for r in rows]
                tbl.sort(key=lambda x: x["power"], reverse=True)
                target = float(data[side].get("target", 0.0))
                em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                out_eye = {"p_emmetropia": em_row["power"], "table": tbl}

                if is_toric:
                    t_rows = eye_res.get("data2", [])
                    out_eye["best_cyl"] = eye_res.get("best_cyl", "")
                    out_eye["toric_table"] = [
                        {"cyl_power": r[0], "residual_cyl": r[1], "axis": r[2]}
                        for r in t_rows if len(r) >= 3
                    ]
                out[side] = out_eye

            browser.close()
            return {"result": out}
    except Exception as e: return {"error": str(e)}

def scrape_barrett_toric_both(data: dict) -> dict: return {"error": "Not implemented"}
def alpins_vector_analysis(*args) -> dict: return {"error": "Not implemented"}
def scrape_jnj_toric_both(data: dict) -> dict: return {"error": "Not implemented"}