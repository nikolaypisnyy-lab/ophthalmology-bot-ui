import sys
import os
from pathlib import Path

# Add API to path
sys.path.append("/root/medeye/api")

try:
    from calculators import scrape_barrett_universal2_both
    
    test_data = {
        "formula": "Barrett",
        "patient_name": "TestClean",
        "od": {"al": 23.5, "k1": 43.0, "k2": 44.0, "acd": 3.2, "a_const": 118.4}
    }
    
    print("Starting Barrett test...")
    res = scrape_barrett_universal2_both(test_data)
    print("Result:", res)

except Exception as e:
    print("FATAL ERROR:", e)
