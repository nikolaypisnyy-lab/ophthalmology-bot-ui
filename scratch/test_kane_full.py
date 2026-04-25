import json
from deploy.calculators import scrape_kane_formula_both

data = {
    "od": {"al": 24.0, "k1": 43.0, "k2": 44.0, "acd": 3.0, "a_const": 118.8, "target": 0.0},
    "os": {"al": 23.5, "k1": 42.0, "k2": 43.0, "acd": 3.1, "a_const": 118.8, "target": 0.0}
}

res = scrape_kane_formula_both(data)
print(json.dumps(res, indent=2))
