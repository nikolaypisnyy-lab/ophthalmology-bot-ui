export type PeriodKey = '1d' | '1w' | '1m' | '3m' | '6m' | '1y';

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  '1d': '1 день',
  '1w': '1 нед',
  '1m': '1 мес',
  '3m': '3 мес',
  '6m': '6 мес',
  '1y': '1 год',
};

export const PERIOD_KEYS: PeriodKey[] = ['1d', '1w', '1m', '3m', '6m', '1y'];

/** Данные одного периода по одному глазу */
export interface PeriodEyeData {
  va?: string;    // UCVA
  bcva?: string;  // BCVA
  ou_va?: string; // OU UCVA
  sph?: string;
  cyl?: string;
  ax?: string;
  k1?: string;
  k2?: string;
  k_ax?: string;
  iop?: string;
  note?: string;
}

/** Одна запись периода (оба глаза + дата) */
export interface PeriodEntry {
  od?: PeriodEyeData;
  os?: PeriodEyeData;
  date?: string;  // ISO date визита
}
