/** Запись об ИОЛ из базы */
export interface IOLLens {
  name: string;
  a: number;        // A-константа (SRK/T, Barrett)
  a_kane: number;   // A-константа Kane
}

/** Биометрические данные для расчёта ИОЛ (по глазу) */
export interface BiometryData {
  al: string;    // Axial Length, мм
  k1: string;    // K1, D
  k2: string;    // K2, D
  k1_ax: string; // ось K1, °
  acd: string;   // Anterior Chamber Depth, мм
  lt: string;    // Lens Thickness, мм
  wtw: string;   // White-to-White, мм
  cct: string;   // CCT, мкм (опц.)
}

/** Дефолтная биометрия */
export function newBiometryData(): BiometryData {
  return { al: '', k1: '', k2: '', k1_ax: '', acd: '', lt: '', wtw: '', cct: '' };
}

/** Одна строка таблицы сферических результатов */
export interface IOLTableRow {
  power: number;
  ref: number;
}

/** Одна строка торической таблицы */
export interface IOLToricRow {
  cyl_power: number;    // цилиндрическая мощность торика
  residual_cyl: number; // остаточный цилиндр
  axis: number;         // ось имплантации
}

/** Результат одной формулы для одного глаза */
export interface IOLFormulaResult {
  p_emmetropia: number;
  table: IOLTableRow[];
  // Торик
  best_cyl?: number;
  toric_table?: IOLToricRow[];
  _toricMode?: boolean;
}

/** Результат расчёта для одного глаза — все формулы */
export interface IOLEyeResult {
  p_emmetropia: number;      // лучшая мощность (из приоритетной формулы)
  table: IOLTableRow[];
  formula: string;
  // Все формулы
  formulas?: Record<string, IOLFormulaResult>;
  // Выбранная пользователем мощность
  selectedPower?: number;
  selectedFormula?: string;
  expectedRefr?: number;
  // Торические данные
  toricModel?: string;
  toricPower?: number;
  toricAx?: number;
  toricResidual?: string;
}

/** Полный результат расчёта (оба глаза + метаданные) */
export interface IOLResult {
  od?: IOLEyeResult;
  os?: IOLEyeResult;
  lens: string;
  aConst: number;
  targetRefr: number;
  timestamp: string;
  source: 'api' | 'local';
}

/** Тело запроса к /api/calculate_iol */
export interface IOLCalcRequest {
  telegram_id: string;
  lens_name: string;
  a_const: number;
  a_const_kane?: number;
  target_refr: number;
  use_barrett?: boolean;
  use_kane?: boolean;
  use_jnj?: boolean;
  use_kane_toric?: boolean;
  kane_sia?: number;
  kane_incision?: number;
  jnj_sia?: number;
  jnj_incision?: number;
  eyes: {
    od?: BiometryData;
    os?: BiometryData;
  };
}

/** Ответ от /api/calculate_iol */
export interface IOLCalcResponse {
  status: 'ok' | 'error';
  data?: {
    od?: IOLEyeResult;
    os?: IOLEyeResult;
  };
  results?: {
    barrett?: Record<string, IOLFormulaResult>;
    kane?: Record<string, IOLFormulaResult>;
    jnj?: Record<string, IOLFormulaResult>;
  };
  detail?: string;
}
