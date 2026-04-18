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
export function roundQ(val: number, doRound: boolean): number {
  if (!doRound) return val;
  return Math.sign(val) * Math.round(Math.abs(val) * 4) / 4;
}

/**
 * Линейная интерполяция.
 */
export function interpolate(
  x: number,
  x0: number, y0: number,
  x1: number, y1: number,
): number {
  if (Math.abs(x1 - x0) < 1e-6) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}
