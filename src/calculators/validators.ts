import type { SafetyLevel } from '../constants/design';

/**
 * Валидация длины глаза (AL).
 * Норма: 22–26 мм. По IOL Calculations:
 * < 22 мм — короткий глаз (высокая ошибка ELP, Kane точнее)
 * > 26 мм — длинный глаз (гиперопический сдвиг у SRK/T, Kane точнее)
 */
export function validateAL(v: string): { ok: boolean; hint: string } {
  const n = parseFloat(v);
  if (isNaN(n) || v === '') return { ok: true, hint: '' };
  if (n < 18 || n > 34) return { ok: false, hint: 'AL вне физиологического диапазона' };
  if (n < 22.0) return { ok: true, hint: 'Короткий глаз — рекомендуется Kane' };
  if (n > 26.0) return { ok: true, hint: 'Длинный глаз — рекомендуется Kane' };
  return { ok: true, hint: '' };
}

/**
 * Валидация кератометрии.
 * По Габбасову: K > 46 D — вопрос о кератоконусе.
 * Противопоказание к ЛАСИК: K < 39 D или K > 49 D.
 * Для ИОЛ норма: 38–50 D.
 */
export function validateK(v: string): { ok: boolean; hint: string } {
  const n = parseFloat(v);
  if (isNaN(n) || v === '') return { ok: true, hint: '' };
  if (n < 35 || n > 55) return { ok: false, hint: 'K вне физиологического диапазона' };
  if (n > 46) return { ok: true, hint: 'K > 46 D — исключите кератоконус' };
  if (n < 39) return { ok: true, hint: 'K < 39 D — плоская роговица' };
  return { ok: true, hint: '' };
}

/**
 * Валидация сферы.
 * Диапазон лазерной коррекции: −12 до +6 D.
 * Выше −8 D — риск регресса (по Габбасову).
 */
export function validateSph(v: string): { ok: boolean; hint: string } {
  const n = parseFloat(v);
  if (isNaN(n) || v === '') return { ok: true, hint: '' };
  if (n < -14 || n > 8) return { ok: false, hint: 'Sph вне диапазона коррекции' };
  if (n < -8)  return { ok: true, hint: '> −8 D: риск регресса' };
  if (n > 4)   return { ok: true, hint: '> +4 D: риск регресса гиперметропии' };
  return { ok: true, hint: '' };
}

/**
 * Валидация CCT (Central Corneal Thickness).
 * По Габбасову: норма 500–550 мкм.
 * Относительное противопоказание < 400–450 мкм.
 */
export function validateCCT(v: string): { ok: boolean; hint: string } {
  const n = parseFloat(v);
  if (isNaN(n) || v === '') return { ok: true, hint: '' };
  if (n < 400) return { ok: false, hint: 'CCT < 400 мкм — противопоказание к ЛКЗ' };
  if (n < 450) return { ok: true, hint: 'CCT < 450 мкм — относительное противопоказание' };
  if (n < 480) return { ok: true, hint: 'CCT пограничная — уточните RSB после расчёта' };
  return { ok: true, hint: '' };
}

/**
 * Цвет остроты зрения.
 * 1.0 = норма, 0.7–1.0 = хорошо, < 0.3 = плохо.
 */
export function vaColor(v: string): SafetyLevel {
  const n = parseFloat(v);
  if (isNaN(n) || v === '') return 'green';
  if (n < 0.3) return 'red';
  if (n < 0.7) return 'yellow';
  return 'green';
}

/**
 * Цвет рефракционного результата.
 * Катаракта: успех ±0.5 D от цели.
 * ЛКЗ: успех ±0.25 D от нуля (эмметропия).
 */
export function refResultColor(
  postSph: number,
  target: number,
  isCat: boolean,
): SafetyLevel {
  const delta = Math.abs(postSph - target);
  const threshold = isCat ? 0.5 : 0.25;
  if (delta <= threshold)       return 'green';
  if (delta <= threshold * 2)   return 'yellow';
  return 'red';
}

/**
 * Оценка астигматизма для торической ИОЛ.
 * По стандарту: ≥ 1.0 D — рекомендуется торик, ≥ 1.5 D — показан.
 */
export function toricIndication(k1: string, k2: string): {
  indicated: boolean;
  recommended: boolean;
  delta: number;
} {
  const k1n = parseFloat(k1);
  const k2n = parseFloat(k2);
  if (isNaN(k1n) || isNaN(k2n)) return { indicated: false, recommended: false, delta: 0 };
  const delta = Math.abs(k1n - k2n);
  return {
    indicated:   delta >= 1.0,
    recommended: delta >= 1.5,
    delta,
  };
}
