import requests
headers={'telegram-id': '379286602', 'clinic-id': 'test_clinic_999'}
r = requests.get('http://localhost:8000/api/patients', headers=headers)
print(r.json()['patients'][0] if r.json().get('patients') else 'No patients')