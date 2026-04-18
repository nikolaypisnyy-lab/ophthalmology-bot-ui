import os
import json
import base64
import time
from typing import List, Optional, Dict, Any
from urllib import request as urlrequest
from dotenv import load_dotenv

load_dotenv(override=True)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_OCR_MODEL = os.getenv('GEMINI_OCR_MODEL', 'gemini-2.0-flash-lite')

def get_gemini_api_key(): return GEMINI_API_KEY
def ocr_available(): return bool(GEMINI_API_KEY)

# --- PROMPT V5: Enhanced Clinical OCR (Refraction & Biometry) ---
PROMPT_V6 = """Ты — специализированный офтальмологический ИИ-парсер.
Распознавай данные даже с фото плохого качества (наклон, тени, рукописный текст, смешанный печатный+рукописный).

══ ТИП ДОКУМЕНТА ══
"cataract" → IOLMaster 700/500, Lenstar, биометрия (AL, ACD, LT, WTW), расчёт ИОЛ.
"refraction" → карта рефракции (LASIK, ФРК, ЛКЗ), авторефрактометр, Pentacam, топография.

══ РУССКАЯ КАРТА РЕФРАКЦИИ (LASIK/ФРК/ЛКЗ) ══
Документ содержит таблицу с колонками OD (правый) и OS (левый).

СТРОКИ И МАППИНГ:
▸ "Манифест. рефракция" / "Vis OD" / "Vis OS":
    - Vis без коррекции → m_va (острота без стёкол, например 0.7)
    - "с коррекцией: +X.XX D cyl -X.XX D ax XXX°" → m_sph, m_cyl, m_ax
    - острота с коррекцией (после =) → игнорируй

▸ "Авторефрактометр (узкий зрачок)" / "Ref OD/OS sph ... cyl ... ax ...":
    → n_sph, n_cyl, n_ax

▸ "Авторефрактометр (циклоплегия)" / "Циклоплегия" / "Ref OD/OS sph ... D ax ...":
    → c_sph, c_cyl, c_ax

══ ЧЕК АВТОРЕФРАКТОМЕТРА (TOPCON / NIDEK / CANON / HUVITZ) ══
Формат: столбцы S (сфера), C (цилиндр), A (ось). Несколько строк измерений.
ВАЖНО: бери ПОСЛЕДНЮЮ (жирную/итоговую) строку для каждого глаза — это среднее.
Формат числа: "- 2.75" = -2.75, "+ 0.25" = +0.25. CYL:(-) означает цилиндр всегда отрицательный.
Пример итоговой строки: "- 2.75 - 1.00 171" → sph:-2.75, cyl:-1.00, ax:171

ОПРЕДЕЛЕНИЕ ТИПА ПО РУКОПИСНОЙ ПОМЕТКЕ НА ЧЕК:
  "узкий" / "уз" / "у/з" / "без мидр" / "не широкий" / "не шир" → n_sph, n_cyl, n_ax
  "широкий" / "шир" / "ш/з" / "цикло" / "с мидр" / "мидр" / "не узкий" → c_sph, c_cyl, c_ax
  "результат" / "рез" / "п/о" / "post" → n_sph, n_cyl, n_ax (измерение после операции)
  Без пометки → n_sph, n_cyl, n_ax (по умолчанию)

НЕСКОЛЬКО ЧЕКОВ НА ОДНОМ ФОТО:
  Читай каждый чек отдельно. Один может быть узким, другой широким.
  Объединяй поля в один JSON (например один чек даёт n_*, другой даёт c_*).

▸ "KER AVG R" = радиус роговицы в мм (игнорируй)
  "KER AVG D" = кератометрия в диоптриях → kavg
  "KER cyl" = цилиндр роговицы → используй для расчёта k1/k2:
      k1 = kavg - abs(kcyl)/2  (плоский меридиан)
      k2 = kavg + abs(kcyl)/2  (крутой меридиан)
      k1_ax = ось KER cyl (если указана)

▸ "К средняя" / "K avg" / "K mean" → kavg
  "K1", "K2" если указаны явно → k1, k2, k1_ax

▸ "ПЗО (мм)" / "Длина оси" → al (мм)

▸ "Толщина роговицы" / "CCT" / "мкм" рядом с числом 480-620 → cct (целое, мкм)

▸ "Д роговицы (WTW)" / "White-to-White" / "Диаметр рогов." → wtw (мм)

▸ "Д зрачка" / "Зрачок мезоп." → игнорируй

ПРИМЕРЫ РАСПОЗНАВАНИЯ:
  "OD = 0,7  с коррекцией: 1,75 D cyl -0,75 D ax 115° = 0,9"
      → m_va: 0.7, m_sph: 1.75, m_cyl: -0.75, m_ax: 115

  "Ref OD sph +2,5 D cyl -0,75 D ax 115°"
      → n_sph: 2.5, n_cyl: -0.75, n_ax: 115

  "KER AVG D 42,7  KER cyl -1,1 D ax 155°"
      → kavg: 42.7, k1: 42.15, k2: 43.25, k1_ax: 155

  "ПЗО мм  21,99" → al: 21.99
  "Толщина роговицы мкм  OD 528" → cct: 528
  "Д роговицы (WTW) 12,48" → wtw: 12.48

══ IOLMaster 700/500 / Lenstar (БИОМЕТРИЯ) ══
Любой документ с длиной оси глаза + кератометрией → type="cataract"

── ДЛИНА ОСИ ГЛАЗА (al, мм, диапазон 20–32) ──
Все возможные метки:
  English:  "AL"  "Axial Length"  "Ax.Length"
  Русский:  "ДО"  "Длина оси"  "Длина оси глаза"  "ПЗО"  "Передне-задний отрезок"
Примеры из реальных документов:
  "AL: 24.03 мм"  → al: 24.03
  "ДО: 24,03 мм (ОСШ = 149.5)"  → al: 24.03  (ОСШ — шумовой индекс, игнорировать)
  "AL: 27.63 мм   (SD = 17 мкм)"  → al: 27.63  (SD — игнорировать)

── ГЛУБИНА ПЕРЕДНЕЙ КАМЕРЫ (acd, мм, диапазон 2.0–5.0) ──
Все возможные метки:
  English:  "ACD"  "Ant.Ch.Depth"  "Anterior Chamber Depth"  "AC Depth"
  Русский:  "ГПК"  "Глубина передней камеры"  "Гл. пер. кам."  "Гл.пер.кам"  "ГПА"
Примеры:
  "ACD: 3.29 мм (SD = 6 мкм)"  → acd: 3.29
  "ГПК: 3.09 мм"  → acd: 3.09

── ТОЛЩИНА ХРУСТАЛИКА (lt, мм, диапазон 3.0–6.0) ──
Метки: "LT"  "Lens Thickness"  "Хрусталик"  "Тол. хруст."
Пример: "LT: 4.15 мм (!)"  → lt: 4.15  (! или SD= — всё равно бери)

── ДИАМЕТР РОГОВИЦЫ (wtw, мм, диапазон 10–14) ──
Метки: "WTW"  "White-to-White"  "CVD"  "Диаметр рог."  "Д рог."
Пример: "WTW: 12,3 мм"  → wtw: 12.3

── CCT (мкм, целое) ──
Метки: "CCT"  "Толщина рог."  "Пахиметрия"

── КЕРАТОМЕТРИЯ (два формата) ──

  Формат A — IOLMaster 700 (символ "@"):
    "K1: XX.XX дптр @ XXX°"  → k1, k1_ax
    "D2: XX.XX дптр @ XXX°"  → k2  ← D2 = второй меридиан = K2!
    "ΔD: XX.XX дптр @ XXX°"  → ПРОПУСТИТЬ  ← ΔD это разность, не K2!

  Формат B — IOLMaster 500 (формат "дптр / мм × °" или "дптр / мм x °"):
    "K1: 42.72 дптр / 7.90 мм × 40°"  → k1: 42.72, k1_ax: 40  (первое число — диоптрии!)
    "K2: 43.38 дптр / 7.78 мм × 130°"  → k2: 43.38               (первое число — диоптрии!)
    "R / СЭ: ..."  → ПРОПУСТИТЬ  (радиус + сферический экв., не нужны)
    "Цил.: -X.XX дптр × XX°"  → ПРОПУСТИТЬ  (отдельная строка цилиндра — не K2!)

ПРАВИЛА кератометрии:
  k1 < k2 всегда; если k1 > k2 — поменять местами вместе с осями.
  k1_ax = ось плоского (меньшего) меридиана.
  Брать только диоптрии (дптр/D), мм-радиусы — игнорировать.

══ PENTACAM / ТОМОГРАФИЯ ══
  Ant. Axial Cyl/Ax → p_ant_c, p_ant_a
  Post. Axial Cyl/Ax → p_post_c, p_post_a
  Total/Net Cyl/Ax → p_tot_c, p_tot_a

══ ПРАВИЛА ══
1. Запятую → точка: "27,63" → 27.63. Плюс писать как число: "+1,75" → 1.75
2. Прочерк "—", "---", пустая ячейка → null
3. k1 < k2 всегда. Если k1 > k2 — поменяй местами.
4. k1_ax = ось плоского (меньшего) меридиана.
5. Возраст: вычисляй из "Дата рождения" или если написано "29л" → age: 29.
6. Пол: "м" / "ж" из документа или по имени (Ализа → ж, Арай → ж).
7. Рукописные цифры: читай внимательно (0 vs О, 1 vs 7, 5 vs 6).
8. Один глаз не измерен (все прочерки) → все поля null для него.
9. Только JSON, никакого текста.

══ СТРУКТУРА JSON ══
{
  "name": "ФИО или null",
  "age": число_лет или null,
  "sex": "м" или "ж" или null,
  "type": "cataract" или "refraction",
  "od": {
    "al": null, "acd": null, "lt": null, "wtw": null, "cct": null,
    "k1": null, "k2": null, "k1_ax": null, "kavg": null,
    "m_sph": null, "m_cyl": null, "m_ax": null, "m_va": null,
    "c_sph": null, "c_cyl": null, "c_ax": null,
    "n_sph": null, "n_cyl": null, "n_ax": null,
    "p_ant_c": null, "p_ant_a": null, "p_post_c": null, "p_post_a": null, "p_tot_c": null, "p_tot_a": null
  },
  "os": { "al": null, "acd": null, "lt": null, "wtw": null, "cct": null,
    "k1": null, "k2": null, "k1_ax": null, "kavg": null,
    "m_sph": null, "m_cyl": null, "m_ax": null, "m_va": null,
    "c_sph": null, "c_cyl": null, "c_ax": null,
    "n_sph": null, "n_cyl": null, "n_ax": null,
    "p_ant_c": null, "p_ant_a": null, "p_post_c": null, "p_post_a": null, "p_tot_c": null, "p_tot_a": null }
}
"""


# --- PROMPT BIOMETRY: IOLMaster / Lenstar dedicated ---
PROMPT_BIOMETRY = """Ты — OCR-экстрактор биометрии глаза (IOLMaster 500/700, Lenstar, NIDEK).
Задача: извлечь числовые измерения из распечатки и вернуть ТОЛЬКО JSON без лишнего текста.

Документ содержит данные OD (правый глаз / od) и/или OS (левый глаз / os).

═══ AL — ДЛИНА ОСИ ГЛАЗА (мм, диапазон 20–32) ═══
Метки (любые из перечисленных):
  AL  /  Axial Length  /  Ax.Length
  ДО  /  Длина оси  /  Длина оси глаза  /  ПЗО  /  Передне-задний отрезок
Примеры из документов:
  "AL: 24.03 мм"                  → al: 24.03
  "ДО: 24,03 мм (ОСШ = 149.5)"   → al: 24.03   (ОСШ, SNR — шумовой индекс, игнорировать)
  "AL: 27.63 мм   (SD = 17 мкм)"  → al: 27.63   (SD в скобках — игнорировать)

═══ ACD — ГЛУБИНА ПЕРЕДНЕЙ КАМЕРЫ (мм, диапазон 2.0–5.0) ═══
Метки:
  ACD  /  Ant.Ch.Depth  /  Anterior Chamber Depth  /  AC Depth
  ГПК  /  Глубина передней камеры  /  Гл.пер.кам  /  Глубина пер. кам.  /  ГПА
Примеры:
  "ACD: 3.29 мм (SD = 6 мкм)"  → acd: 3.29
  "ГПК: 3.09 мм"               → acd: 3.09

═══ LT — ТОЛЩИНА ХРУСТАЛИКА (мм, диапазон 3.0–6.0) ═══
Метки: LT  /  Lens Thickness  /  Толщина хрусталика
Пример: "LT: 4.15 мм (!)"  → lt: 4.15   (пометки !, SD=... — игнорировать, значение брать)

═══ WTW — ДИАМЕТР РОГОВИЦЫ (мм, диапазон 10–14) ═══
Метки: WTW  /  White-to-White  /  CVD  /  Диаметр рог.  /  Д рог.
Пример: "WTW: 12,3 мм"  → wtw: 12.3

═══ CCT — ТОЛЩИНА РОГОВИЦЫ (мкм, целое, диапазон 400–650) ═══
Метки: CCT  /  Пахиметрия  /  Толщина рог.

═══ КЕРАТОМЕТРИЯ — ДВА ФОРМАТА ═══

ФОРМАТ A — IOLMaster 700 (значения через "@"):
  "K1: 41.30 дптр @ 175°"  → k1: 41.30, k1_ax: 175
  "D2: 45.72 дптр @ 85°"   → k2: 45.72   ← D2 = второй меридиан = K2!
  "ΔD: -4.41 дптр @ 175°"  → ПРОПУСТИТЬ  ← ΔD это разность K2-K1, не само значение!
  SE / СЭ / Реф. / Цел.рефр. → ПРОПУСТИТЬ

ФОРМАТ B — IOLMaster 500 ("дптр / мм × °" или "дптр / мм x °"):
  "K1: 42.72 дптр / 7.90 мм × 40°"   → k1: 42.72, k1_ax: 40    (ПЕРВОЕ число — диоптрии!)
  "K2: 43.38 дптр / 7.78 мм × 130°"  → k2: 43.38                (ПЕРВОЕ число — диоптрии!)
  "R / СЭ: 7.84 мм / 43.05 дптр"     → ПРОПУСТИТЬ (радиус роговицы)
  "Цил.: -0.66 дптр × 40°"            → ПРОПУСТИТЬ (отдельная строка цилиндра — не K2!)

ПРАВИЛА кератометрии:
  k1 < k2 всегда. Если k1 > k2 — поменяй местами вместе с осями.
  k1_ax = ось плоского (меньшего) меридиана.
  Брать только диоптрии (дптр/D). Мм-значения (радиус кривизны) — игнорировать.

═══ ОБЩИЕ ПРАВИЛА ═══
1. Запятую → точка: "24,03" → 24.03
2. Прочерк "—", "---", "..." или пустая ячейка → null
3. Глаз не измерен (все поля прочерки) → все null для него
4. Возраст: вычисляй из даты рождения если есть; "29л" → 29
5. Пол: из документа или по имени; "м"/"ж"/"male"/"female"
6. Только JSON. Никакого текста до или после JSON.

═══ СТРУКТУРА ОТВЕТА ═══
{
  "name": "ФИО или null",
  "age": число или null,
  "sex": "м" или "ж" или null,
  "type": "cataract",
  "od": {
    "al": null,
    "acd": null,
    "lt": null,
    "wtw": null,
    "cct": null,
    "k1": null,
    "k2": null,
    "k1_ax": null
  },
  "os": {
    "al": null,
    "acd": null,
    "lt": null,
    "wtw": null,
    "cct": null,
    "k1": null,
    "k2": null,
    "k1_ax": null
  }
}
"""


# --- PROMPT REFRACTION V3: Structured Clinical OCR ---
PROMPT_REFRACTION = """Ты — медицинский OCR-экстрактор офтальмологических данных. Твоя единственная задача — вернуть валидный JSON. Никакого текста до или после JSON.

## ЭТАП 1: ПРЕДОБРАБОТКА ИЗОБРАЖЕНИЯ
- Изображение может быть размытым, под углом, с тенями — это нормально
- Рукописные цифры приоритетнее печатных (они актуальнее)
- Запятая и точка взаимозаменяемы: 1,75 = 1.75
- Символы °, D, sph, cyl, ax, Ref, ~ — служебные, в JSON не попадают
- Тильда "~" перед cyl — разделитель, не знак числа
- Запятую меняй на точку: "27,63" → 27.63

## ЭТАП 2: МАТРИЦА ИЗВЛЕЧЕНИЯ

### ПОЛЕ: manifest
Это строка/секция с надписью ЛЮБОГО из вариантов:
"Манифест. рефракция" / "Манифест рефракция" / "Манифестная рефракция" / "MANIFEST" / "Manifest refr."

Структура данных в строке:
  OD = [UVA]  с коррекцией: [Sph] D cyl [Cyl] D ax [Axis]° = [BVA]
  OS = [UVA]  с коррекцией: [Sph] D cyl [Cyl] D ax [Axis]° = [BVA]

ПРАВИЛА:
- UVA = первое число после "OD =" (ДО слова "коррекц"), острота БЕЗ стёкол
- BVA = последнее число ПОСЛЕ финального "=", острота СО стёклами
- Sph = число ПОСЛЕ "коррекцией:" и ПЕРЕД "D cyl" (без знака = положительное)
- Cyl = число после "cyl" (в этих картах почти всегда отрицательное, проверь наличие минуса)
- Axis = целое число 0–180, стоит сразу после "ax" в той же строке или непосредственно за ней.
  Если неуверен к какой строке относится число — лучше null, чем неверное значение.
- Опечатки: "су"/"cy"/"суl" = "cyl",  "спh"/"зph" = "sph"
- Если видишь только "Vis OD 0.7 / 1.0" без коррекции — UVA=0.7, BVA=1.0, sph/cyl/axis=null

### ПОЛЕ: autoref_narrow
Строка/секция: "Автореф (узкий зрачок)" / "Авторефрактометр узк" / "Ref узк" / "S C A" таблица чека без пометки.

На ЧЕКЕ АВТОРЕФРАКТОМЕТРА (TOPCON/NIDEK/HUVITZ/CANON): бери ПОСЛЕДНЮЮ (итоговую/жирную) строку для каждого глаза.
  Пример: "R  -2.75  -0.75  165" → OD sph:-2.75, cyl:-0.75, axis:165

На КАРТЕ РЕФРАКЦИИ:
  Структура: Ref OD sph [±Sph] D ~ cyl [Cyl] D ax [Axis]°
  "+" перед sph → положительное, "-" → отрицательное.

### ПОЛЕ: keratometry
ИЩИ В ЛЮБОМ МЕСТЕ ДОКУМЕНТА. Кератометрия может быть:
1. На рефракционной карте — в той же строке, что авторефрактометр узкий
2. На чеке авторефрактометра — отдельная секция "KER" внизу чека

ПАТТЕРНЫ (все варианты):
  "KER AVG D [X]" или "K avg D [X]"  → KER_mean (диапазон 38–48 D)
  "Kavg: [X]D"  → KER_mean
  "KER cyl [X]" или "KER cyl: [X]D"  → KER_cyl (обычно отрицательное, -0.1 до -4.0)
  "@ [XX]°" или "ax [XX]°" после KER cyl  → KER_axis

ВАЖНО — ИГНОРИРУЙ радиусы в мм:
  "KER AVG R 7.82" или "R1/R2 X.XXmm" — это мм, не нужны
  "D1: XX.X" / "D2: XX.X" — это отдельные меридианы, не kavg

Пример с карты: "KER AVG D 42,7  KER cyl -1,1 D ax 155°" → KER_mean:42.7, KER_cyl:-1.1, KER_axis:155
Пример с чека:  "Kavg: 43.89D   KER cyl: -1.50D @ 82°"  → KER_mean:43.89, KER_cyl:-1.5, KER_axis:82

### ПОЛЕ: autoref_wide
Строка/секция: "Автореф (циклоплегия)" / "Авторефр широкий" / "Цикло" / "Ref цикло".
На чеке: итоговая строка чека с пометкой "широкий"/"цикло"/"шир"/"мидр".
Аналогично autoref_narrow. Sph обычно выше (циклоплегия расширяет).

## ЭТАП 3: ВАЛИДАЦИЯ
Если значение выходит за диапазон — перечитай участок изображения:
- UVA, BVA: 0.01 – 2.0
- Sph: -20.0 – +20.0
- Cyl: -8.0 – 0.0 (почти всегда отрицательный)
- Axis: 0 – 180
- KER_mean: 38.0 – 50.0
- KER_cyl: -4.0 – 0.0
Поле не читается или отсутствует → null (не 0, не "")

## ЭТАП 4: ВЫВОД
Верни ТОЛЬКО этот JSON (без markdown, без ```json, без пояснений):

{
  "name": null,
  "age": null,
  "sex": null,
  "OD": {
    "manifest": { "UVA": null, "sph": null, "cyl": null, "axis": null, "BVA": null },
    "autoref_narrow": { "sph": null, "cyl": null, "axis": null },
    "keratometry": { "KER_mean": null, "KER_cyl": null, "KER_axis": null },
    "autoref_wide": { "sph": null, "cyl": null, "axis": null }
  },
  "OS": {
    "manifest": { "UVA": null, "sph": null, "cyl": null, "axis": null, "BVA": null },
    "autoref_narrow": { "sph": null, "cyl": null, "axis": null },
    "keratometry": { "KER_mean": null, "KER_cyl": null, "KER_axis": null },
    "autoref_wide": { "sph": null, "cyl": null, "axis": null }
  }
}

name: ФИО пациента если указано, иначе null.
age: возраст числом (вычисли из даты рождения если есть), иначе null.
sex: "м" или "ж" из документа или по имени, иначе null.
Все числа — float (axis — int). Разделитель дробной части — точка.
"""

# Таргет-специфичные инструкции для нового рефракционного промта
REFR_TARGET_INSTR = {
    'manifest':    "ФОКУС: Только строку МАНИФЕСТНАЯ рефракция → manifest.{{sph,cyl,axis,UVA,BVA}}. Остальные секции → null.\n",
    'narrow':      "ФОКУС: Только АВТОРЕФРАКТОМЕТР (узкий зрачок) → autoref_narrow + keratometry если есть на том же чеке. Остальные → null.\n",
    'cyclo':       "ФОКУС: Только ЦИКЛОПЛЕГИЯ / авторефр широкий → autoref_wide.{{sph,cyl,axis}}. Остальные → null.\n",
    'keratometry': "ФОКУС: Только кератометрия → keratometry.{{KER_mean,KER_cyl,KER_axis}}. Остальные → null.\n",
    'autoref':     "Определи по пометкам: узкий зрачок → autoref_narrow, широкий/цикло → autoref_wide. Оба заполняй если оба чека на фото.\n",
}

# Таргеты, для которых используется новый рефракционный промт.
# 'all' включён — большинство общих сканов в WebApp это рефракционные карты.
# Биометрия (IOLMaster) вызывается явно с target='biometry' и попадает в PROMPT_V6.
REFR_TARGETS = {'manifest', 'narrow', 'cyclo', 'autoref', 'keratometry', 'all'}


def _flatten_refraction_ocr(raw: dict) -> dict:
    """Конвертирует новый формат {OD:{manifest,autoref_narrow,...}} → старый плоский {od:{m_sph,...}}."""
    if not isinstance(raw, dict):
        return raw
    # Определяем nested формат по содержимому, а не по регистру ключей (Gemini может вернуть od/os вместо OD/OS)
    first_eye = raw.get('OD') or raw.get('od') or {}
    is_nested = isinstance(first_eye, dict) and any(
        k in first_eye for k in ('manifest', 'autoref_narrow', 'keratometry', 'autoref_wide')
    )
    if not is_nested:
        return raw

    def fv(v):
        if v is None: return None
        try: return float(str(v).replace(',', '.'))
        except: return None

    def fi(v):
        if v is None: return None
        try: return int(float(str(v).replace(',', '.')))
        except: return None

    def flatten_eye(eye_data):
        if not isinstance(eye_data, dict):
            return {}
        m = eye_data.get('manifest') or {}
        n = eye_data.get('autoref_narrow') or {}
        k = eye_data.get('keratometry') or {}
        w = eye_data.get('autoref_wide') or {}

        kavg = fv(k.get('KER_mean'))
        kcyl = fv(k.get('KER_cyl'))
        k1_ax = fi(k.get('KER_axis'))
        k1, k2 = None, None
        if kavg is not None and kcyl is not None:
            half = abs(kcyl) / 2.0
            k1 = round(kavg - half, 2)
            k2 = round(kavg + half, 2)

        return {
            'm_sph': fv(m.get('sph')),  'm_cyl': fv(m.get('cyl')),
            'm_ax':  fi(m.get('axis')), 'm_va':  fv(m.get('BVA')),
            'uva':   fv(m.get('UVA')),
            'n_sph': fv(n.get('sph')),  'n_cyl': fv(n.get('cyl')),
            'n_ax':  fi(n.get('axis')),
            'c_sph': fv(w.get('sph')),  'c_cyl': fv(w.get('cyl')),
            'c_ax':  fi(w.get('axis')),
            'kavg':  kavg, 'k1': k1, 'k2': k2, 'k1_ax': k1_ax,
            'kercyl': kcyl,
        }

    return {
        'name': raw.get('name') or None,
        'age':  raw.get('age') or None,
        'sex':  raw.get('sex') or None,
        'type': 'refraction',
        'od':   flatten_eye(raw.get('OD') or raw.get('od') or {}),
        'os':   flatten_eye(raw.get('OS') or raw.get('os') or {}),
    }

# mime type detection by file extension
_MIME_MAP = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'png': 'image/png', 'webp': 'image/webp',
    'gif': 'image/gif', 'pdf': 'application/pdf',
}

def _get_mime(path: str) -> str:
    ext = path.rsplit('.', 1)[-1].lower() if '.' in path else ''
    return _MIME_MAP.get(ext, 'image/jpeg')


def gemini_parse_ocr_image(image_paths, target='all'):
    api_key = get_gemini_api_key()
    if not api_key:
        return {'error': 'No API key configured'}

    # Target-specific focus instructions
    target_instr = {
        'manifest':    "ФОКУС: Только МАНИФЕСТНАЯ рефракция (m_sph, m_cyl, m_ax, m_va). type='refraction'.\n",
        'narrow':      "ФОКУС: Только АВТОРЕФРАКТОМЕТР узкий зрачок (n_sph, n_cyl, n_ax). type='refraction'.\n",
        'cyclo':       "ФОКУС: Только циклоплегия/широкий зрачок (c_sph, c_cyl, c_ax). type='refraction'.\n",
        'autoref':     "ФОКУС: Авторефрактометр. Узкий зрачок → n_sph/n_cyl/n_ax. Широкий → c_sph/c_cyl/c_ax. type='refraction'.\n",
        'pentacam':    "ФОКУС: Только PENTACAM/томография (p_ant_c/a, p_post_c/a, p_tot_c/a). type='refraction'.\n",
        'keratometry': "ФОКУС: Только кератометрия (k1, k2, k1_ax, kavg). type='refraction'.\n",
        'biometry':    "ФОКУС: БИОМЕТРИЯ IOLMaster/Lenstar. Всегда type='cataract'. Извлеки: al (метки: AL/ДО/Длина оси/ПЗО), acd (метки: ACD/ГПК/Глубина передней камеры/ГПА), lt (LT/Толщина хрусталика), wtw (WTW/CVD). Кератометрия формат 700: K1@°→k1, D2@°→k2, ΔD→пропустить. Формат 500: K1 дптр/мм x °→k1 (первое число), K2 дптр/мм x °→k2, Цил.→пропустить.\n",
    }.get(target, '')

    image_parts = []
    for p in image_paths:
        try:
            with open(p, 'rb') as f:
                data = f.read()
            mime = _get_mime(p)
            image_parts.append({
                'inline_data': {'mime_type': mime, 'data': base64.b64encode(data).decode('utf-8')}
            })
        except Exception as e:
            print(f"OCR: error reading {p}: {e}")

    if not image_parts:
        return {'error': 'No valid images to process'}

    # Выбираем промт по target
    use_refr_prompt = target in REFR_TARGETS
    use_bio_prompt  = target == 'biometry'
    if use_bio_prompt:
        prompt_text = PROMPT_BIOMETRY
    elif use_refr_prompt:
        refr_instr = REFR_TARGET_INSTR.get(target, '')
        prompt_text = refr_instr + PROMPT_REFRACTION
    else:
        prompt_text = target_instr + PROMPT_V6

    payload = {
        'contents': [{'parts': [{'text': prompt_text}] + image_parts}],
        'generationConfig': {
            'temperature': 0.0,
            'response_mime_type': 'application/json',
        }
    }

    url = (
        f'https://generativelanguage.googleapis.com/v1beta/models/'
        f'{GEMINI_OCR_MODEL}:generateContent?key={api_key}'
    )

    last_error = 'Unknown error'
    for attempt in range(3):
        try:
            req = urlrequest.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            with urlrequest.urlopen(req, timeout=60) as resp:
                resp_obj = json.loads(resp.read().decode('utf-8'))

            # Check for Gemini-level error
            if 'error' in resp_obj:
                msg = resp_obj['error'].get('message', str(resp_obj['error']))
                last_error = f'Gemini API error: {msg}'
                print(f"OCR attempt {attempt+1} Gemini error: {msg}")
                time.sleep(2)
                continue

            text = resp_obj['candidates'][0]['content']['parts'][0]['text']
            print(f"OCR RAW (attempt {attempt+1}): {text[:300]}")
            try:
                with open('/root/app/deploy/ocr_debug.log', 'a') as f:
                    f.write(f"\n--- {time.ctime()} target={target} ---\n{text}\n")
            except:
                pass

            result = json.loads(text)
            if not isinstance(result, dict):
                last_error = 'Gemini returned non-dict JSON'
                time.sleep(2)
                continue
            # Конвертируем новый рефракционный формат в плоский
            if use_refr_prompt:
                result = _flatten_refraction_ocr(result)
            return result

        except Exception as e:
            last_error = str(e)
            print(f"OCR attempt {attempt+1} failed: {e}")
            if attempt < 2:
                time.sleep(2)

    return {'error': last_error}


def normalize_ocr_draft(raw_json: dict, is_ocr=False) -> dict:
    if not isinstance(raw_json, dict):
        return {}

    # If Gemini returned an error dict — don't treat it as valid data
    if 'error' in raw_json:
        print(f"OCR normalize: rejecting error response: {raw_json.get('error')}")
        return {}

    def val(obj, key):
        v = obj.get(key)
        if v is None:
            return None
        try:
            return float(str(v).replace(',', '.'))
        except:
            return None

    def val_int(obj, key):
        """For integer fields like CCT (micrometers), axis degrees."""
        v = obj.get(key)
        if v is None:
            return None
        try:
            return int(float(str(v).replace(',', '.')))
        except:
            return None

    def map_eye(data):
        if not data or not isinstance(data, dict):
            return {}
        return {
            # Manifest refraction
            'man_sph':  val(data, 'm_sph'),
            'man_cyl':  val(data, 'm_cyl'),
            'man_ax':   val_int(data, 'm_ax'),
            'bcva':     val(data, 'm_va'),
            'uva':      val(data, 'uva'),
            # Cycloplegic / wide pupil
            'c_sph':    val(data, 'c_sph'),
            'c_cyl':    val(data, 'c_cyl'),
            'c_ax':     val_int(data, 'c_ax'),
            # Narrow pupil autoref
            'n_sph':    val(data, 'n_sph'),
            'n_cyl':    val(data, 'n_cyl'),
            'n_ax':     val_int(data, 'n_ax'),
            # Keratometry
            'k1':       val(data, 'k1'),
            'k2':       val(data, 'k2'),
            'k1_ax':    val_int(data, 'k1_ax'),
            'kavg':     val(data, 'kavg'),
            'kercyl':   val(data, 'kercyl'),
            # Pentacam
            'p_ant_c':  val(data, 'p_ant_c'),
            'p_ant_a':  val_int(data, 'p_ant_a'),
            'p_post_c': val(data, 'p_post_c'),
            'p_post_a': val_int(data, 'p_post_a'),
            'p_tot_c':  val(data, 'p_tot_c'),
            'p_tot_a':  val_int(data, 'p_tot_a'),
            # Biometry
            'al':       val(data, 'al'),
            'acd':      val(data, 'acd'),
            'lt':       val(data, 'lt'),
            'wtw':      val(data, 'wtw'),
            'cct':      val_int(data, 'cct'),
        }

    res = {
        'name': str(raw_json.get('name') or '').strip(),
        'age':  raw_json.get('age'),
        'sex':  raw_json.get('sex'),
        'type': raw_json.get('type'),
        'od':   map_eye(raw_json.get('od') or {}),
        'os':   map_eye(raw_json.get('os') or {}),
    }

    # Validate age
    if res['age'] is not None:
        try:
            age = int(float(str(res['age']).replace(',', '.')))
            res['age'] = age if 1 <= age <= 110 else None
        except:
            res['age'] = None

    # Validate sex
    if res['sex'] not in ('м', 'ж', 'М', 'Ж', 'м.', 'ж.', 'male', 'female'):
        res['sex'] = None
    elif res['sex']:
        res['sex'] = 'м' if res['sex'].lower().startswith('м') else 'ж'

    return res


# Псевдонимы
def gemini_clinical_analysis(p): return "..."
clinical_analysis = gemini_clinical_analysis
def generate_patient_summary(p): return "..."
patient_summary = generate_patient_summary
