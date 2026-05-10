import { Language } from '../store/useClinicStore';

export const T = (lang: Language) => {
  const translations = {
    en: {
      // Common
      all: 'Patients',
      refraction: 'Refraction',
      cataract: 'Cataract',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      loading: 'Loading...',
      noResults: 'No results found',
      noPatients: 'No patients',
      search: 'Search patients...',
      back: 'Back',
      operated: 'OPERATED',
      planned: 'PLANNED',

      // Results Page
      resultsTitle: 'Results',
      totalCases: 'Total Cases',
      iolSuccess: 'IOL Success',
      lasikSuccess: 'LASIK Success',
      nomogramTitle: 'LASER NOMOGRAM',
      proAnalytics: 'Pro Analytics',
      eyesAnalyzed: 'Eyes Analyzed',
      sphereSE: 'Sphere (SE)',
      cylinder: 'Cylinder',
      correction: 'Correction',
      apply: 'APPLY',
      active: 'ACTIVE',
      noCasesRecorded: 'No cases recorded yet',

      // Settings
      settings: 'Settings',
      currentDb: 'Current Database',
      dataManagement: 'Data Management (SQLite)',
      sendTelegram: 'Send to Telegram Bot',
      downloadDevice: 'Download to device (.db)',
      uploadDb: 'Upload patient database (.db)',
      clinic: 'Clinic',
      clinicLaser: 'Clinic Laser',
      language: 'Language',
      accessDenied: 'Access Denied',
      retry: 'Retry',
      dbSentTelegram: 'Database successfully sent to your Telegram!',
      dbImported: 'Database successfully imported! The app will be reloaded.',
      importWarning: 'WARNING: Import will completely REPLACE the current database. Are you sure?',

      // Patient Card / Form
      newPatient: 'New Patient',
      scanRecords: 'Enter details or scan clinical records',
      scan: 'SCAN',
      fullName: 'Full Name',
      age: 'Age',
      gender: 'Gender',
      male: 'MALE',
      female: 'FEMALE',
      clinicalPath: 'Clinical Path',
      surgeryEye: 'Surgery Eye',
      createPatient: 'Create Patient Entry',
      years: 'years',
      rightEye: 'Right Eye (OD)',
      leftEye: 'Left Eye (OS)',

      bio: 'EXAM',
      calc: 'IOL',
      plan: 'PLAN',
      result: 'RESULT',
      enhancement: 'ENH',

      // OCR
      ocrTitle: 'OCR Recognition',
      selectFile: 'Select Photo / PDF',
      multiSelectHint: 'you can select several at once',
      ocrHint: 'Autoref, Pentacam, Reports',
      dataRecognized: 'Data Recognized',
      recognizing: 'Recognizing...',
      recognize: 'Recognize',
      restart: 'Reset',
      applyData: 'Apply Data',
      iolPower: 'IOL Power',
      predictedRefr: 'Predicted Refraction',
      target: 'Target',
      variants: 'Variants',
      noData: 'No Data',
      selectFormulaToCalc: 'Select formula to calculate',
      toricRecommendation: 'Toric Recommendation',
      noLensSelected: 'No Lens Selected',
      surgery: 'Surgery',
      surgicalSummary: 'Surgical Summary',
      implantedIOL: 'Implanted IOL',
      toricComponent: 'Toric Component',
      power: 'Power',
      comparison: 'Comparison',
      axis: 'Axis',
      vision: 'Vision',
      clinicalNotes: 'Clinical Notes',
      finishSave: 'Finish & Save',
    },
    ru: {
      // Common
      all: 'Пациенты',
      refraction: 'Рефракция',
      cataract: 'Катаракта',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      loading: 'Загрузка...',
      noResults: 'Ничего не найдено',
      noPatients: 'Нет пациентов',
      search: 'Поиск пациентов...',
      back: 'Назад',
      operated: 'ОПЕРИРОВАН',
      planned: 'ЗАПЛАНИРОВАН',

      // Results Page
      resultsTitle: 'Результаты',
      totalCases: 'Всего случаев',
      iolSuccess: 'Успех ИОЛ',
      lasikSuccess: 'Успех ЛКЗ',
      nomogramTitle: 'ЛАЗЕРНАЯ НОМОГРАММА',
      proAnalytics: 'Про-аналитика',
      eyesAnalyzed: 'Глаз проанализировано',
      sphereSE: 'Сфера (SE)',
      cylinder: 'Цилиндр',
      correction: 'Поправка',
      apply: 'ПРИМЕНИТЬ',
      active: 'АКТИВНО',
      noCasesRecorded: 'Случаев пока не записано',

      // Settings
      settings: 'Настройки',
      currentDb: 'Текущая база данных',
      dataManagement: 'Работа с данными (SQLite)',
      sendTelegram: 'Прислать в Telegram бота',
      downloadDevice: 'Скачать на устройство (.db)',
      uploadDb: 'Загрузить базу пациентов (.db)',
      clinic: 'Клиника',
      clinicLaser: 'Лазер клиники',
      language: 'Язык',
      accessDenied: 'Нет доступа',
      retry: 'Повторить',
      dbSentTelegram: 'База успешно отправлена вам в Telegram!',
      dbImported: 'База успешно импортирована! Приложение будет перезагружено.',
      importWarning: 'ВНИМАНИЕ: Импорт полностью ЗАМЕНИТ текущую базу данных. Вы уверены?',

      // Patient Card / Form
      newPatient: 'Новый пациент',
      scanRecords: 'Введите данные или отсканируйте выписки',
      scan: 'СКАН',
      fullName: 'ФИО',
      age: 'Возраст',
      gender: 'Пол',
      male: 'МУЖ',
      female: 'ЖЕН',
      clinicalPath: 'Клинический путь',
      surgeryEye: 'Глаз операции',
      createPatient: 'Создать карточку',
      years: 'лет',
      rightEye: 'Правый глаз (OD)',
      leftEye: 'Левый глаз (OS)',

      bio: 'БИО',
      calc: 'ИОЛ',
      plan: 'ПЛАН',
      result: 'РЕЗУЛЬТАТ',
      enhancement: 'ДОКОР',

      // OCR
      ocrTitle: 'OCR Распознавание',
      selectFile: 'Выбрать фото / PDF',
      multiSelectHint: 'можно выделить сразу несколько',
      ocrHint: 'Автореф, Pentacam, Выписки',
      dataRecognized: 'Данные распознаны',
      recognizing: 'Распознавание...',
      recognize: 'Распознать',
      restart: 'Заново',
      applyData: 'Применить данные',
      iolPower: 'Сила ИОЛ',
      predictedRefr: 'Ожидаемая рефракция',
      target: 'Цель',
      variants: 'Вариантов',
      noData: 'Нет данных',
      selectFormulaToCalc: 'Выберите формулу для расчета',
      toricRecommendation: 'Рекомендация Toric',
      noLensSelected: 'Линза не выбрана',
      surgery: 'Операции',
      surgicalSummary: 'Сводка операции',
      implantedIOL: 'Имплантированная ИОЛ',
      toricComponent: 'Торический компонент',
      power: 'Сила',
      comparison: 'Сравнение',
      axis: 'Ось',
      vision: 'Зрение',
      clinicalNotes: 'Клинические заметки',
      finishSave: 'Завершить и сохранить',
    }
  };

  return translations[lang];
};

export const getAgeSuffix = (age: number | string | undefined, lang: Language): string => {
  if (!age) return '';
  if (lang !== 'ru') return ' y.o.';
  const n = Math.abs(parseInt(String(age)));
  if (isNaN(n)) return ' лет';
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return ' год';
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return ' года';
  return ' лет';
};
