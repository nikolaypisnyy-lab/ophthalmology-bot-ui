import asyncio
from playwright.sync_api import sync_playwright
from calculators import scrape_kane_formula_both
data = {
    'patient_name': 'Test Local',
    'use_kane_toric': True,
    'kane_sia': 0.2,
    'kane_incision': 90,
    'od': {'al': 26.5, 'k1': 43.0, 'k2': 44.5, 'k1_ax': 175, 'acd': 3.5, 'target': 0.0, 'a_const': 118.8},
    'os': {'al': 26.5, 'k1': 43.0, 'k2': 44.5, 'k1_ax': 5, 'acd': 3.5, 'target': 0.0, 'a_const': 118.8}
}
# Override the headless flag temporarily for this local test
import builtins
builtins.PLAYWRIGHT_HEADLESS = False

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    print(scrape_kane_formula_both(data))
