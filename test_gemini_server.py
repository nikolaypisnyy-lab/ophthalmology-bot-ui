import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv('/root/app/deploy/.env')
api_key = os.getenv('GEMINI_API_KEY')
print(f"Using key: {api_key[:5]}...{api_key[-5:]}")

genai.configure(api_key=api_key)

print("Listing models:")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"Error listing models: {e}")

model_name = 'gemini-flash-latest'
print(f"\nTesting model: {model_name}")
try:
    model = genai.GenerativeModel(model_name)
    response = model.generate_content("Hello, reply with only 'OK'")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error testing {model_name}: {e}")
