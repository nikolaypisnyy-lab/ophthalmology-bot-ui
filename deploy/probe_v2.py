from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=api_key)

models = [
    'gemini-2.5-flash', 
    'gemini-3-flash-preview', 
    'gemini-2.0-flash',
    'veo-2.0-generate-001'
]

for m in models:
    try:
        resp = client.models.generate_content(model=m, contents='hi')
        print(f'SUCCESS: {m}')
        break
    except Exception as e:
        print(f'FAIL: {m}: {str(e)[:100]}')
