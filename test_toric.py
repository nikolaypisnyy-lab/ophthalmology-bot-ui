import json, asyncio
from calculators import scrape_kane_formula_both

data = {
    'patient_name': 'Test Toric Eye',
    'use_kane_toric': True,
    'kane_sia': 0.2,
    'kane_incision': 90,
    'od': {'al': 26.5, 'k1': 43.0, 'k1_ax': 175, 'k2': 44.5, 'a_const': 118.8, 'target': 0.0, 'acd': 3.5},
    'os': {'al': 26.5, 'k1': 43.0, 'k1_ax': 5, 'k2': 44.5, 'a_const': 118.8, 'target': 0.0, 'acd': 3.5}
}

res = scrape_kane_formula_both(data)
print(json.dumps(res, indent=2))
