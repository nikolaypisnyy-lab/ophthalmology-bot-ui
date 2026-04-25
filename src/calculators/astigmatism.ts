/** Вектор астигматизма (Alpins notation) */
export interface AstigVector {
  x: number;
  y: number;
}

/**
 * Преобразует цилиндр + ось в вектор двойного угла.
 * Знак cyl ожидается отрицательным (минусовая нотация).
 */
export function astigVector(cyl: number, ax: number): AstigVector | null {
  if (isNaN(cyl) || isNaN(ax)) return null;
  const rad = (ax * Math.PI) / 180;
  const mag = -cyl; // переворачиваем знак для работы с magnitude
  return {
    x: mag * Math.cos(2 * rad),
    y: mag * Math.sin(2 * rad),
  };
}

/** Магнитуда вектора */
export function vectorMag(v: AstigVector | null): number {
  if (!v) return 0;
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Ось вектора (0–180°) */
export function vectorAxis(v: AstigVector | null): number {
  if (!v || (v.x === 0 && v.y === 0)) return 0;
  let a = (Math.atan2(v.y, v.x) / 2) * (180 / Math.PI);
  if (a < 0) a += 180;
  return Math.round(a);
}

/** Разность векторов (a − b) */
export function vectorDiff(a: AstigVector | null, b: AstigVector | null): AstigVector | null {
  if (!a || !b) return null;
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Сумма двух цилиндров (векторное сложение).
 * Возвращает результирующий цилиндр и ось.
 */
export function sumCylinders(
  c1: number, a1: number,
  c2: number, a2: number,
): { cyl: number; ax: number } {
  if (isNaN(c1)) c1 = 0;
  if (isNaN(a1)) a1 = 0;
  if (isNaN(c2)) c2 = 0;
  if (isNaN(a2)) a2 = 0;

  const r1 = (a1 * Math.PI) / 180;
  const r2 = (a2 * Math.PI) / 180;
  const cx = c1 * Math.cos(2 * r1) + c2 * Math.cos(2 * r2);
  const cy = c1 * Math.sin(2 * r1) + c2 * Math.sin(2 * r2);

  let cTot = -Math.sqrt(cx * cx + cy * cy);
  let aTot = (Math.atan2(-cy, -cx) / 2) * (180 / Math.PI);
  if (aTot <= 0) aTot += 180;

  return { cyl: cTot, ax: Math.round(aTot) };
}

/**
 * Разница осей (0–90°).
 */
export function angleDiff(a: number, b: number): number | null {
  if (isNaN(a) || isNaN(b)) return null;
  let d = Math.abs(((a - b) % 180 + 180) % 180);
  if (d > 90) d = 180 - d;
  return Math.round(d * 10) / 10;
}

/**
 * Округление до шага 0.25 D (если doRound = true).
 */
/**
 * Abulafia-Koch adjustment (2016) for posterior corneal astigmatism.
 */
export function applyAbulafiaKoch(cyl: number, axis: number, al: number = 23.5): { cyl: number; ax: number } {
  // Векторный анализ использует удвоенный угол
  const rad = (axis * Math.PI) / 90; // 2 * rad
  const vx = cyl * Math.cos(rad);
  const vy = cyl * Math.sin(rad);

  const pcaBase = 0.38;
  const pcaAdj = pcaBase - 0.015 * (al - 23.5);
  const pcaVal = Math.max(0.20, Math.min(0.50, pcaAdj));

  const xAdj = 0.98 * vx + pcaVal;
  const yAdj = 0.98 * vy;

  const mag = Math.sqrt(xAdj * xAdj + yAdj * yAdj);
  let a = (Math.atan2(yAdj, xAdj) / 2) * (180 / Math.PI);
  while (a < 0) a += 180;
  while (a >= 180) a -= 180;

  return { cyl: mag, ax: Math.round(a) };
}

/**
 * Surgically Induced Astigmatism (SIA) compensation.
 */
export function applySIA(cyl: number, axis: number, sia: number, incAx: number): { cyl: number; ax: number } {
  const r1 = (axis * Math.PI) / 90;
  const r2 = (incAx * Math.PI) / 90;
  
  // SIA adds -SIA along the incision axis (flattening)
  const vx = cyl * Math.cos(r1) - sia * Math.cos(r2);
  const vy = cyl * Math.sin(r1) - sia * Math.sin(r2);

  const mag = Math.sqrt(vx * vx + vy * vy);
  let a = (Math.atan2(vy, vx) / 2) * (180 / Math.PI);
  while (a < 0) a += 180;
  while (a >= 180) a -= 180;

  return { cyl: mag, ax: Math.round(a) };
}

export const AlconToricModels = [
  { model: "T2", cyl_iol: 1.00, ratio: 1.46 },
  { model: "T3", cyl_iol: 1.50, ratio: 1.46 },
  { model: "T4", cyl_iol: 2.25, ratio: 1.46 },
  { model: "T5", cyl_iol: 3.00, ratio: 1.46 },
  { model: "T6", cyl_iol: 3.75, ratio: 1.46 },
  { model: "T7", cyl_iol: 4.50, ratio: 1.46 },
  { model: "T8", cyl_iol: 5.25, ratio: 1.46 },
  { model: "T9", cyl_iol: 6.00, ratio: 1.46 },
];

export function calculateToricJS(k1: number, k2: number, k1_ax: number, sia: number, incAx: number, al: number = 23.5) {
  const cylNet = Math.abs(k2 - k1);
  const steepAxis = k2 > k1 ? (k1_ax + 90) % 180 : k1_ax;

  const adj = applyAbulafiaKoch(cylNet, steepAxis, al);
  const final = applySIA(adj.cyl, adj.ax, sia, incAx);

  const suggestions = AlconToricModels.map(m => {
    const cCornea = m.cyl_iol / 1.46;
    
    // Векторная разность: target - lens
    const r1 = (final.ax * Math.PI) / 90;
    const vx = final.cyl * Math.cos(r1) - cCornea * Math.cos(r1);
    const vy = final.cyl * Math.sin(r1) - cCornea * Math.sin(r1);

    const resMag = Math.sqrt(vx * vx + vy * vy);
    let resAx = (Math.atan2(vy, vx) / 2) * (180 / Math.PI);
    while (resAx < 0) resAx += 180;
    while (resAx >= 180) resAx -= 180;
    
    // In minus notation, WTR (steep @ 90) has residual axis near 180/0.
    // ATR (steep @ 180) has residual axis near 90.
    const isWTR = resAx < 45 || resAx > 135;

    return {
      model: m.model,
      cyl_iol: m.cyl_iol,
      cyl_cornea: cCornea,
      residual: resMag,
      res_axis: Math.round(resAx === 0 ? 180 : resAx),
      is_wtr: isWTR
    };
  });

  // Добавляем None
  const noneResAx = Math.round(final.ax);
  suggestions.unshift({
    model: "None",
    cyl_iol: 0,
    cyl_cornea: 0,
    residual: final.cyl,
    res_axis: noneResAx === 0 ? 180 : noneResAx,
    is_wtr: noneResAx < 45 || noneResAx > 135
  });

  const wtrOptions = suggestions.filter(s => s.is_wtr && s.residual < 0.6);
  const bestModel = wtrOptions.length > 0 
    ? wtrOptions.reduce((prev, curr) => curr.residual < prev.residual ? curr : prev).model
    : suggestions.reduce((prev, curr) => curr.residual < prev.residual ? curr : prev).model;

  return {
    net_corneal_cyl: cylNet,
    total_corneal_cyl_adj: final.cyl,
    total_steep_axis: final.ax,
    best_model: bestModel,
    table: suggestions
  };
}

export function roundQ(val: number, doRound: boolean): number {
  if (!doRound) return val;
  return Math.sign(val) * Math.round(Math.abs(val) * 4) / 4;
}

export function interpolate(
  x: number,
  x0: number, y0: number,
  x1: number, y1: number,
): number {
  if (Math.abs(x1 - x0) < 1e-6) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}
