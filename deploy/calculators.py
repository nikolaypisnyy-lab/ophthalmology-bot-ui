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
    sides = [s for s in ["od", "os"] if s in data and data[s].get("al")]
    if not sides:
        return {"error": "No eye data provided"}
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
            )
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                viewport={'width': 1366, 'height': 768},
            )
            page = context.new_page()

            print("[Kane] Navigating to agreement...")
            page.goto("https://www.iolformula.com/agreement/", timeout=60000, wait_until="networkidle")

            try:
                page.wait_for_selector(".btn_agreement", timeout=8000)
                page.locator(".btn_agreement").click()
                page.wait_for_url("https://www.iolformula.com/", timeout=10000)
                page.wait_for_timeout(2000)
                print("[Kane] Agreement accepted, on calculator page")
            except Exception as e:
                print(f"[Kane] Agreement step failed: {e}")
                browser.close()
                return {"error": f"Kane: agreement page failed: {e}"}

            # Gender: GetFormData() uses jQuery('[name="gender_1"]').is(':checked')
            # Must use jQuery .prop() so jQuery :checked works
            sex_val = ""
            for s in ["od", "os"]:
                if s in data and data[s].get("sex"):
                    sex_val = str(data[s]["sex"]).lower()
                    break
            gender_name = "gender_2" if sex_val in ("ж", "f", "female") else "gender_1"
            page.evaluate("""(gname) => {
                jQuery('[name="' + gname + '"]').prop('checked', true).trigger('change');
            }""", gender_name)

            # Fill biometry — use Array.from().find() to avoid CSS-selector quote issues
            def fill_by_name(name_attr, val):
                try:
                    page.evaluate("""([n, v]) => {
                        const el = Array.from(document.querySelectorAll('[name]')).find(e => e.name === n);
                        if (!el) return;
                        el.value = v;
                        el.dispatchEvent(new Event('input', {bubbles: true}));
                        el.dispatchEvent(new Event('change', {bubbles: true}));
                    }""", [name_attr, str(val)])
                except Exception:
                    pass

            # Kane requires eye1 (right) to be filled for calculation to trigger.
            # Map slots: always put first available eye in slot 1, second in slot 2.
            slot_map = {}  # slot_index (1 or 2) → original side key
            for i, side in enumerate(sides):
                slot = i + 1  # 1-based
                slot_map[slot] = side

            for slot, side in slot_map.items():
                d = data[side]
                side_label = "right" if slot == 1 else "left"
                suff = str(slot)
                print(f"[Kane] Filling {side} → slot {slot} ({side_label})...")
                page.evaluate("""(n) => { jQuery('[name="' + n + '"]').prop('checked', true).trigger('change'); }""",
                               f"nontoric_{suff}")
                fill_by_name(f"al_{side_label}",   d.get("al", ""))
                fill_by_name(f"k1_{side_label}",   d.get("k1", ""))
                fill_by_name(f"k2_{side_label}",   d.get("k2", ""))
                fill_by_name(f"acd_{side_label}",  d.get("acd", ""))
                fill_by_name(f"aconstant_{suff}",  d.get("a_const", "118.8"))
                fill_by_name(f"target_ref_{suff}", d.get("target", "0"))

            page.wait_for_timeout(1000)

            print("[Kane] Clicking Calculate...")
            page.locator("input.calculate").click()

            # Wait for results table to populate (visibility:visible on res_tab3)
            print("[Kane] Waiting for results...")
            try:
                page.wait_for_selector(".res_tab3_lines tr td", timeout=30000)
                page.wait_for_timeout(1000)
            except Exception as fe:
                try:
                    page.screenshot(path="/root/medeye/backups/kane_last_error.png")
                except Exception:
                    pass
                browser.close()
                return {"error": f"Kane: results not found. {fe}"}

            # Parse from eye1_results / eye2_results containers → res_tab3_lines
            results_data = page.evaluate("""() => {
                const parseContainer = (cls) => {
                    const container = document.querySelector('.' + cls);
                    if (!container) return [];
                    const rows = [];
                    container.querySelectorAll('.res_tab3_lines tr').forEach(tr => {
                        const cells = tr.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const pv = parseFloat(cells[0].innerText.replace(',', '.'));
                            const rv = parseFloat(cells[1].innerText.replace(',', '.'));
                            if (!isNaN(pv) && !isNaN(rv)) rows.push([pv, rv]);
                        }
                    });
                    return rows;
                };
                return { eye1: parseContainer('eye1_results'), eye2: parseContainer('eye2_results') };
            }""")

            for slot, side in slot_map.items():
                eye_key = f"eye{slot}"
                rows = results_data.get(eye_key, [])
                print(f"[Kane] {side} (slot {slot}): {len(rows)} rows")
                if not rows:
                    continue
                tbl = [{"power": r[0], "ref": r[1]} for r in rows]
                tbl.sort(key=lambda x: x["power"], reverse=True)
                target = float(data[side].get("target", 0.0))
                em_row = min(tbl, key=lambda x: abs(x["ref"] - target))
                out[side] = {"p_emmetropia": em_row["power"], "table": tbl}

            browser.close()
            return {"result": out}
    except Exception as e:
        return {"error": str(e)}

def scrape_barrett_toric_both(data: dict) -> dict: return {"error": "Not implemented"}
def alpins_vector_analysis(*args) -> dict: return {"error": "Not implemented"}
def scrape_jnj_toric_both(data: dict) -> dict: return {"error": "Not implemented"}