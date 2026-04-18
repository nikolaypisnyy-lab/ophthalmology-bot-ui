import type { LaserType } from '../types/refraction';
import type { SafetyLevel } from '../constants/design';

export interface RefStats {
  abl:   number;        // глубина абляции / толщина лентикулы, мкм
  rsb:   number | null; // Residual Stromal Bed, мкм
  pta:   string | null; // Percent Tissue Altered, %
  kpost: string | null; // постоп кривизна роговицы, D
}

/**
 * Рассчитать показатели безопасности ЛКЗ.
 *
 * Источники:
 * — Габбасов А.Р. «Лазерная коррекция зрения», 2009:
 *   нормальная CCT 500–550 мкм, относительное противопоказание < 400–450 мкм
 * — Международные стандарты RSB/PTA/Kpost
 */
export function computeRefStats(
  planSph:   string | number,
  planCyl:   string | number,
  oz:        string | number,
  isLenticule: boolean,
  cct:       string | number,
  capOrFlap: string | number,
  minTh:     string | number,
  k1:        string | number,
  k2:        string | number,
  kavg:      string | number,
  laserId:   LaserType,
): RefStats {
  const sph  = parseFloat(String(planSph))   || 0;
  const cyl  = parseFloat(String(planCyl))   || 0;
  const ozN  = parseFloat(String(oz))        || 6.5;
  const cctN = parseFloat(String(cct))       || 0;
  const cut  = parseFloat(String(capOrFlap)) || 0;

  // ── Расчёт глубины абляции / лентикулы ──────────────────────────────────────
  let depth = 0;

  if (isLenticule) {
    // SMILE / SmartSight / SILK — лентикула
    // Толщина = (SE × OZ²) / 3 + min thickness
    const se = Math.abs(sph + cyl / 2);
    depth = (se * ozN * ozN) / 3 + (parseFloat(String(minTh)) || 15);
  } else {
    // Фотоабляция (LASIK/FRK/MEL90)
    if (sph <= 0 && cyl <= 0) {
      // Миопия / миопический астигматизм
      // Сфера: глубина = (OZ² × |Sph|) / 3 × 1.25
      // Цилиндр: глубина = (OZ² × |Cyl|) / 6 × 1.25 (полуглубина)
      depth =
        ((ozN * ozN) * Math.abs(sph) / 3) * 1.25 +
        ((ozN * ozN) * Math.abs(cyl) / 6) * 1.25;
    } else if (sph > 0 && (sph + cyl) >= 0) {
      // Гиперметропия — упрощённая оценка (аннулярная абляция)
      depth = ((ozN * ozN) * sph / 3) * 1.5;
      depth = Math.max(depth, 15);
    } else {
      // Смешанный астигматизм
      depth = ((ozN * ozN) * Math.abs(sph + cyl) / 3) * 1.25;
    }

    // Лазер-специфичные модификаторы эффективности абляции
    // (коэффициенты из клинических данных производителей)
    if      (laserId === 'ex500')     depth *= 0.90;  // EX500 ~10% эффективнее
    else if (laserId === 'visx_s4ir') depth *= 0.83;  // VISX S4 IR ~17% эффективнее
    else if (laserId === 'mel90')     depth *= 0.95;  // MEL90 умеренная коррекция
  }

  depth = Math.max(0, depth);

  // ── RSB (Residual Stromal Bed) ───────────────────────────────────────────────
  // RSB = CCT − флэп/кэп − глубина абляции
  let rsb: number | null = null;
  let pta: string | null = null;

  if (cctN > 0 && cut > 0) {
    rsb = Math.round(cctN - cut - depth);
    pta = (((cut + depth) / cctN) * 100).toFixed(1);
  } else if (cctN > 0 && isLenticule) {
    // Для SMILE кэп задаётся отдельно
    rsb = Math.round(cctN - cut - depth);
    pta = (((cut + depth) / cctN) * 100).toFixed(1);
  }

  // ── Kpost (постоп кривизна роговицы) ────────────────────────────────────────
  // Kpost = Kpre + SE плана
  // SE плана = sph + cyl/2 (со знаком — при миопии отрицательный, роговица уплощается)
  const kpre =
    (k1 && k2 && parseFloat(String(k1)) > 0 && parseFloat(String(k2)) > 0)
      ? (parseFloat(String(k1)) + parseFloat(String(k2))) / 2
      : parseFloat(String(kavg)) || 0;

  const kpost = kpre > 0
    ? (kpre + (sph + cyl / 2.0)).toFixed(2)
    : null;

  return {
    abl:   Math.round(depth),
    rsb,
    pta,
    kpost,
  };
}

// ── Уровни безопасности ───────────────────────────────────────────────────────

/**
 * RSB — Residual Stromal Bed.
 * Стандарт: ≥ 300 мкм безопасно, < 250 мкм — высокий риск ятрогенной эктазии.
 */
export function rsbLevel(rsb: number | null): SafetyLevel {
  if (rsb === null) return 'green';
  if (rsb < 250)   return 'red';
  if (rsb < 300)   return 'yellow';
  return 'green';
}

/**
 * PTA — Percent Tissue Altered.
 * Стандарт: ≤ 35% безопасно, > 40% — высокий риск.
 */
export function ptaLevel(pta: string | null): SafetyLevel {
  if (pta === null) return 'green';
  const v = parseFloat(pta);
  if (v > 40) return 'red';
  if (v > 35) return 'yellow';
  return 'green';
}

/**
 * Kpost — кривизна роговицы после операции.
 *
 * Исправлено по клиническим данным:
 * — < 38 D: высокий риск (слишком плоская роговица → ятрогенная эктазия / нарушение оптики)
 * — 38–40 D: погранично (наблюдение)
 * — 40–46 D: норма (оптимальный диапазон)
 * — 46–49 D: допустимо
 * — ≥ 49 D: высокий риск (слишком крутая → возможна эктазия при высокой оптике)
 *
 * Источник: Габбасов — оптическая сила роговицы < 39 или > 49 D = противопоказание к ЛАСИК.
 * Международный стандарт Kpost: красный < 38 D или > 49 D.
 */
export function kpostLevel(kpost: string | null): SafetyLevel {
  if (kpost === null) return 'green';
  const v = parseFloat(kpost);
  if (v < 38 || v >= 49) return 'red';
  if (v < 40 || v >= 47) return 'yellow';
  return 'green';
}

/**
 * Abl — глубина абляции (фотоабляция) или толщина лентикулы (SMILE).
 * Стандарт: ≤ 100 мкм безопасно, > 130 мкм — высокий риск.
 */
export function ablLevel(abl: number): SafetyLevel {
  if (abl > 130) return 'red';
  if (abl > 100) return 'yellow';
  return 'green';
}

/**
 * Совокупная оценка безопасности — наихудший из показателей.
 */
export function overallSafetyLevel(stats: RefStats): SafetyLevel {
  const levels: SafetyLevel[] = [
    rsbLevel(stats.rsb),
    ptaLevel(stats.pta),
    kpostLevel(stats.kpost),
    ablLevel(stats.abl),
  ];
  if (levels.includes('red'))    return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}
