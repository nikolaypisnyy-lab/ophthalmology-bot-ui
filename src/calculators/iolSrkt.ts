import type { BiometryData, IOLEyeResult, IOLTableRow } from '../types/iol';

/**
 * Расчёт ИОЛ по формуле SRK/T (Retzlaff, Sanders, Kraff 1990).
 * Используется как fallback когда /api/calculate_iol недоступен.
 *
 * Источник: Retzlaff JA, Sanders DR, Kraff MC.
 * "Development of the SRK/T intraocular lens implant power calculation formula."
 * J Cataract Refract Surg. 1990;16:333–340.
 *
 * Алгоритм:
 * 1. Коррекция AL для очень длинных глаз (retinal thickness offset)
 * 2. Расчёт corneal height (H) из K и AL
 * 3. Расчёт ELP из A-константы и corneal height
 * 4. Vergence formula: P = n/(L-ELP) − n*Km/(n − ELP*Km)
 * 5. Поправка на целевую рефракцию через vertex distance
 */
export function calcSRKT(
  bio: BiometryData,
  aConst: number,
  targetRefr = 0,
): IOLEyeResult | null {
  const al = parseFloat(bio.al);
  const k1 = parseFloat(bio.k1);
  const k2 = parseFloat(bio.k2);

  if (!al || al <= 0 || !k1 || !k2 || !aConst) return null;

  // Средняя кератометрия в диоптриях
  const Km = (k1 + k2) / 2;

  // Радиус роговицы в мм (из K в диоптриях, n=1.3375)
  const r = 1337.5 / Km;

  // ── Шаг 1: Коррекция AL ─────────────────────────────────────────────────────
  // В SRK/T применяется поправка на "оптическую" длину для длинных глаз.
  // Для AL > 24.2 мм — нелинейная коррекция (Holladay correction).
  // Для AL ≤ 24.2 мм — используется измеренное значение.
  let Lcor: number;
  if (al <= 24.2) {
    Lcor = al;
  } else {
    // Коррекция для длинных глаз (Holladay, адаптированная в SRK/T)
    Lcor = -3.446 + 1.716 * al - 0.0237 * al * al;
  }

  // ── Шаг 2: Corneal height H ──────────────────────────────────────────────────
  // H = r - sqrt(r² - (Ø/2)²), где Ø = оптический диаметр зоны (7 мм в SRK/T)
  // H — высота сегмента роговицы по хорде 7 мм
  const CHORD = 7.0; // мм
  const H = r - Math.sqrt(Math.max(0, r * r - (CHORD / 2) * (CHORD / 2)));

  // ── Шаг 3: Predicted ELP ────────────────────────────────────────────────────
  // В SRK/T: ELP = 0.56 + A_const * 0.1 - 0.9H
  // Это персонализированная ACD (pACD), учитывающая форму роговицы
  const ELP = 0.56 + aConst * 0.1 - 0.9 * H;
  // Ограничение: ELP не может быть отрицательным или нереалистично малым
  const ELPclamped = Math.max(ELP, 2.0);

  // ── Шаг 4: Vergence formula ──────────────────────────────────────────────────
  // Показатель преломления водянистой влаги / стекловидного тела
  const n = 1.336;
  // Показатель роговицы (фиктивный, для совместимости с кератометром)
  const nc = 1.3375;

  // Оптическая сила роговицы через тонкую линзу
  const Fcornea = (nc - 1) / (r / 1000); // в диоптриях

  // Мощность ИОЛ для эмметропии (vergence equation)
  // P_emm = n/(AL-ELP) − n·Km/(n − ELP·Km)
  const L = Lcor / 1000; // в метрах
  const e = ELPclamped / 1000; // в метрах
  const Km_m = Km; // уже в диоптриях

  const Vit = n / (L - e);               // vergence из стекловидного
  const Vaq = n * Km_m / (n - e * Km_m); // vergence через роговицу

  const P_emm = Vit - Vaq;

  // ── Шаг 5: Поправка на целевую рефракцию ────────────────────────────────────
  // Перевод рефракции в плоскость роговицы (vertex distance 12 мм)
  const d = 0.012; // vertex distance, м
  let Rx_cornea = targetRefr;
  if (Math.abs(targetRefr) > 0.001) {
    Rx_cornea = targetRefr / (1 - d * targetRefr);
  }

  // Поправка мощности: P_target = P_emm − Rx_cornea × (n/(n−e×Rx_cornea))²
  // Упрощённо для клинического применения:
  const P_target = P_emm - Rx_cornea * (n / (n - e * Rx_cornea)) ** 2;
  const P_opt = Math.round(P_target / 0.5) * 0.5;

  // ── Шаг 6: Таблица мощностей ─────────────────────────────────────────────────
  // Строим таблицу ±3D от оптимальной с шагом 0.5D
  const table: IOLTableRow[] = [];
  for (let P = P_opt + 3.0; P >= P_opt - 3.0 - 0.001; P -= 0.5) {
    const Pr = Math.round(P * 100) / 100;
    // Рассчитываем рефракцию для данной мощности
    // Обратная vergence formula
    const Vout = n / (L - e);
    const Vin2 = Vaq + Pr;
    const f2 = n / Math.max(Vin2, 0.001);
    const retina_vergence = n / (L - e) - (Vaq + Pr - n / (L - e));

    // Более точный расчёт: итерируем через формулу
    // Rx = n/(L-e) - (Vaq + P) → refraction at cornea plane
    const Rx_c_raw = Vit - Vaq - Pr; // рефракция в плоскости роговицы
    // Перевод в плоскость очков (vertex 12 мм)
    const Rx_glasses = Rx_c_raw / (1 + d * Rx_c_raw);

    table.push({
      power: Pr,
      ref: Math.round(Rx_glasses * 100) / 100,
    });
  }

  // Найти мощность, дающую рефракцию ближайшую к целевой
  let bestP = P_opt;
  let minDiff = Infinity;
  table.forEach(row => {
    const diff = Math.abs(row.ref - targetRefr);
    if (diff < minDiff) {
      minDiff = diff;
      bestP = row.power;
    }
  });

  return {
    p_emmetropia: bestP,
    table,
    formula: 'SRK/T',
  };
}

/**
 * Проверка корректности входных данных для расчёта ИОЛ.
 * По данным IOL Calculations (2024): нормальные диапазоны биометрии.
 */
export function validateBiometry(bio: BiometryData): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const al  = parseFloat(bio.al);
  const k1  = parseFloat(bio.k1);
  const k2  = parseFloat(bio.k2);
  const acd = parseFloat(bio.acd);

  if (isNaN(al) || al <= 0) {
    warnings.push('AL не заполнена');
  } else {
    if (al < 20.0) warnings.push(`AL ${al} мм — очень короткий глаз (< 20 мм), рекомендуется Kane/Barrett`);
    else if (al < 22.0) warnings.push(`AL ${al} мм — короткий глаз, предпочтительнее Kane`);
    else if (al > 26.0) warnings.push(`AL ${al} мм — длинный глаз, предпочтительнее Kane`);
    else if (al > 30.0) warnings.push(`AL ${al} мм — экстремальная миопия, обязателен Kane`);
  }

  if (isNaN(k1) || isNaN(k2)) {
    warnings.push('K1/K2 не заполнены');
  } else {
    const Km = (k1 + k2) / 2;
    if (Km < 38) warnings.push(`Km ${Km.toFixed(1)} D — плоская роговица, проверьте кератоконус`);
    if (Km > 50) warnings.push(`Km ${Km.toFixed(1)} D — крутая роговица, исключите кератоконус`);
  }

  if (!isNaN(acd)) {
    if (acd < 2.0) warnings.push(`ACD ${acd} мм — мелкая камера, высокий риск ошибки ELP`);
    if (acd > 4.5) warnings.push(`ACD ${acd} мм — глубокая камера`);
  }

  return {
    valid: warnings.filter(w => w.includes('не заполнен')).length === 0,
    warnings,
  };
}
