from google import genai
from google.genai import types
import os
from dotenv import load_dotenv
import json

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

# Список из ВАШЕГО лога доступных моделей
models = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-flash-001'
]

with open('test_image.jpg', 'rb') as f:
    img_data = f.read()

for m in models:
    print(f'TRYING MODEL: {m}')
    try:
        parts = [types.Part.from_text(text='Extract AL, ACD, K1, K2 from this ocular biometry image as JSON'),
                 types.Part.from_bytes(data=img_data, mime_type='image/jpeg')]
        resp = client.models.generate_content(model=m, contents=[types.Content(role='user', parts=parts)])
        if resp.text:
            print(f'SUCCESS: {m}')
            print(resp.text)
            break
    except Exception as e:
        print(f'FAIL: {m}: {str(e)[:100]}')
