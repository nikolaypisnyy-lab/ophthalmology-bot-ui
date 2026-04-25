
import requests
import json

URL = "http://localhost:8000/api/calculate_iol"

payload = {
    "data": {
        "name": "Test Patient",
        "age": "30",
        "sex": "M",
        "const_a_barrett": 119.3,
        "const_a_kane": 119.3,
        "use_barrett": True,
        "use_kane": True,
        "use_kane_toric": False,
        "kane_sia": 0.1,
        "kane_incision": 90,
        "od": {
            "al": 23.5,
            "k1": 43.0,
            "k2": 44.0,
            "acd": 3.5,
            "k1_ax": 0,
            "target": 0.0
        }
    }
}

headers = {
    "Content-Type": "application/json",
    "telegram-id": "379286602"
}

try:
    response = requests.post(URL, json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
except Exception as e:
    print(f"Error: {e}")
