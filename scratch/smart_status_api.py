import os
import re

API_PATH = "/root/medeye/api/api.py"

def update_api():
    with open(API_PATH, "r") as f:
        content = f.read()

    # Ищем место, где формируется список пациентов (обычно get_patients)
    # Мы хотим добавить логику динамического вычисления статуса
    
    # Сначала проверим, как сейчас выглядит get_patients
    print("Searching for get_patients logic...")
    
    # Вносим правку: при получении списка пациентов, если у них есть записи в measurements,
    # мы будем перезаписывать их статус на 'done' перед отправкой на фронтенд.
    
    # Но проще всего - поправить логику в классе MedEyeDB в database.py,
    # чтобы метод get_patients сам это делал.
    
    return content

if __name__ == "__main__":
    update_api()
