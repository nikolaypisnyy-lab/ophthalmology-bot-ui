import json
import re
import sys
import time
from playwright.sync_api import sync_playwright

def test_barrett():
    data = {
        "patient_name": "ServerTest",
        "od": {"al": 23.5, "k1": 43.0, "k2": 44.0, "a_const": 118.8, "target": 0.0}
    }
    
    print("[TEST] Starting Playwright...")
    try:
        with sync_playwright() as p:
            print("[TEST] Launching Browser...")
            browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = browser.new_page()
            
            print("[TEST] Navigating to Barrett...")
            page.goto("https://calc.apacrs.org/barrett_universal2105/", timeout=60000)
            
            print("[TEST] Checking for Agree button...")
            try:
                page.locator("input[value*='Agree' i]").first.click(timeout=5000)
                print("[TEST] Clicked Agree.")
            except:
                print("[TEST] Agree button not found or already clicked.")
            
            print("[TEST] Filling patient data...")
            page.wait_for_selector("#MainContent_Axlength", timeout=20000)
            page.fill("#MainContent_PatientName", "Test Patient")
            page.fill("#MainContent_Aconstant", "118.8")
            
            page.fill("#MainContent_Axlength", "23.5")
            page.fill("#MainContent_MeasuredK1", "43.0")
            page.fill("#MainContent_MeasuredK2", "44.0")
            
            print("[TEST] Clicking Calculate...")
            page.click("#MainContent_Button1")
            
            print("[TEST] Waiting for results...")
            page.wait_for_timeout(5000)
            
            tables = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('table')).map(t => t.innerText);
            }""")
            
            print(f"[TEST] Found {len(tables)} tables.")
            if len(tables) > 0:
                print("[TEST] SUCCESS! Table content sample:")
                print(tables[0][:200])
            else:
                print("[TEST] FAIL: No tables found.")
                
            browser.close()
    except Exception as e:
        print(f"[TEST] CRITICAL ERROR: {e}")

if __name__ == "__main__":
    test_barrett()
