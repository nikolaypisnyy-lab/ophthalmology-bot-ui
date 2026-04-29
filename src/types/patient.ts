export type PatientType = 'refraction' | 'cataract';
export type EyeSide = 'OD' | 'OS' | 'OU';
export type TabKey = 'bio' | 'calc' | 'plan' | 'result' | 'enhancement';

export interface PatientSummary {
  id: string;
  name: string;
  age: string;
  sex?: 'М' | 'Ж';
  type: PatientType;
  eye: EyeSide;
  date?: string;           // ISO date операции
  status?: 'planned' | 'done';
  targetRefr?: string;
  domEye?: 'OD' | 'OS';
  surgeon?: string;
  note?: string;
  // краткая рефракция для карточки
  postSph?: number;
  postCyl?: number;
  postSphOD?: number;
  postCylOD?: number;
  postAxOD?: number;
  postVaOD?: string;
  postSphOS?: number;
  postCylOS?: number;
  postAxOS?: number;
  postVaOS?: string;
  isEnhancement?: boolean; // флаг докоррекции для календаря
  surgicalOrder?: number;  // порядок в операционном списке
  useClinicNomo?: boolean;
  flapDiam?: string;       // диаметр флэпа
  capOrFlap?: string;      // толщина флэпа
  isPRK?: boolean;
  isCustomView?: boolean;
  isCustomViewOD?: boolean;
  isCustomViewOS?: boolean;
  iolResult?: import('./iol').IOLResult;
  toricResults?: Record<'od' | 'os', any>;
  savedPlan?: {
    od?: import('./refraction').RefractionPlan;
    os?: import('./refraction').RefractionPlan;
  };
}

export interface Patient extends PatientSummary {
  // Рефракция по глазам
  od?: import('./refraction').EyeData;
  os?: import('./refraction').EyeData;

  // Биометрия ИОЛ (только для cataract)
  bio_od?: import('./iol').BiometryData;
  bio_os?: import('./iol').BiometryData;

  // Результаты ИОЛ-расчёта
  iolResult?: import('./iol').IOLResult;

  // Сохранённый план ЛКЗ (inherited from PatientSummary)
  savedEnhancement?: {
    od?: import('./refraction').RefractionPlan;
    os?: import('./refraction').RefractionPlan;
  };
  planAuthor?: 'auto' | 'surgeon';
  planTweaked?: boolean;

  // Остаточная рефракция для докоррекции
  residual_od?: { sph: string; cyl: string; ax: string };
  residual_os?: { sph: string; cyl: string; ax: string };

  // Настройки операции
  laser?: import('./refraction').LaserType;
  oz?: string;             // оптическая зона, мм
  sia?: string;            // SIA хирурга, D
  siaAx?: string;          // ось SIA
  capOrFlap?: string;      // толщина кэпа/флэпа, мкм
  flapDiam?: string;       // диаметр флэпа, мм
  minTh?: string;          // min толщина лентикулы (SMILE)
  useCorneal?: boolean;    // использовать роговичный астигматизм (legacy, заменяется astigStrategy)
  astigStrategy?: 'manifest' | 'corneal' | 'vector' | 'wavefront'; // стратегия астигматизма
  pentaStrategy?: 'station' | 'anterior' | 'posterior' | 'total'; // стратегия Pentacam
  noNomogram?: boolean;    // не применять номограммы (только манифест)
  doRound?: boolean;       // округлять до 0.25
  isPRK?: boolean;
  isCustomView?: boolean;
  isCustomViewOD?: boolean;
  isCustomViewOS?: boolean;

  // Калькулятор ИОЛ
  activeFormula?: 'Haigis' | 'Barrett' | 'Kane';
  formulaResults?: { od: Record<string, any>; os: Record<string, any> };
  incAx?: string;          // ось разреза (для торика)

  // Торик
  toricMode?: boolean;  // включён торический расчёт ИОЛ
  toricCyl?: string;
  toricAx?: string;
  toricResidual?: string;

  // Постоп результаты по периодам
  periods?: Record<import('./results').PeriodKey, {
    od?: import('./results').PeriodEyeData;
    os?: import('./results').PeriodEyeData;
  }>;

  // Устаревшие поля (legacy compat)
  res_od?: import('./results').PeriodEyeData;
  res_os?: import('./results').PeriodEyeData;
}
