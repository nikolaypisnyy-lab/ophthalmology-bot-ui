# RefMaster 2.0 — Claude Project Context

## Что это за проект
Офтальмологическое веб-приложение (Telegram Mini App) для хирургов-офтальмологов.
Управление пациентами, расчёт ИОЛ, OCR биометрии/рефракции через Gemini AI.

## Стек
- **Фронтенд:** React 18 + TypeScript + Zustand + Vite (Telegram Mini App)
- **Бэкенд:** FastAPI (Python) + SQLite — `deploy/api.py`
- **OCR:** Google Gemini 2.0 Flash Lite — `deploy/ocr_engine.py`
- **Деплой:** GitHub Actions → rsync → `root@92.38.48.231:/root/medeye_bot/`

## Репозиторий
`https://github.com/nikolaypisnyy-lab/RefMaster-2.0.git` ветка `main`

## Деплой
Любой `git push` в `main` → автоматический деплой через `.github/workflows/deploy.yml`.
**deploy_medeye.sh НЕ использовать** — устарел.

## Ключевые файлы

### Бэкенд (`deploy/`)
- `api.py` — FastAPI endpoints: пациенты, OCR, расчёт ИОЛ, авторизация клиник
- `ocr_engine.py` — Gemini OCR: 3 промта (PROMPT_BIOMETRY, PROMPT_REFRACTION, PROMPT_V6)
- `calculators.py` — расчёты ИОЛ (SRK/T, Barrett, Kane)
- `database.py` — SQLite, отдельная БД на каждую клинику
- `config.py` — настройки, API ключи

### Фронтенд (`src/`)
- `App.tsx` — роутинг страниц
- `pages/PatientsPage.tsx` — список пациентов
- `pages/ResultsPage.tsx` — результаты операций (пациенты со status='done')
- `pages/OperationsPage.tsx` — план операций
- `features/patient-card/PatientCard.tsx` — карточка пациента, handleSave()
- `features/patient-card/PatientHeader.tsx` — шапка с табами и кнопкой OCR
- `features/patient-card/tabs/BioTab.tsx` — вкладка биометрии/рефракции
- `features/patient-card/tabs/CalcTab.tsx` — расчёт ИОЛ
- `features/patient-card/tabs/PlanTab.tsx` — план операции
- `features/patient-card/tabs/ResultTab.tsx` — результат операции
- `features/ocr/OCRModal.tsx` — OCR модал, mapGeminiToFields(), apply()
- `store/usePatientStore.ts` — стор пациентов, fetchPatients(), savePatient()
- `store/useSessionStore.ts` — текущий черновик пациента (draft)
- `store/useUIStore.ts` — UI состояние: activeTab, openOCR(), targetSection
- `constants/design.ts` — цвета (C.*) и шрифты (F.*)

## Типы пациентов
- `refraction` — рефракционный (ЛКЗ/LASIK): вкладки bio, plan, result, enhancement
- `cataract` — катаракта: вкладки bio, calc, plan, result

## OCR routing (ocr_engine.py)
- `target='biometry'` → `PROMPT_BIOMETRY` (ИОЛМастер: AL, ACD, K1/K2, LT, WTW)
- `target` в REFR_TARGETS → `PROMPT_REFRACTION` (манифест, авторефракция, кератометрия)
- иначе → `PROMPT_V6` (общий)

## Поля БД / черновика
- Рефракция: `man_sph/cyl/ax`, `n_sph/cyl/ax`, `c_sph/cyl/ax`, `kercyl`, `kerax`
- Биометрия (катаракта): `bio_od`/`bio_os` — JSON объект с al, acd, k1, k2, lt, wtw
- Результат: `postSph`, `postSphOD`, `postSphOS` → вычисляются в handleSave() из periods

## Важные детали
- Тип пациента (`cataract`/`refraction`) задаётся при создании и НЕ меняется через OCR
- `status: 'done'` устанавливается в handleSave() когда есть данные периода
- localStorage кэш: `rm_patients` (список) и `rm_pdata` (полные данные)
- Дизайн: тёмная тема, gradient background `#0d0c1a → #16143a`
