/**
 * Haigis IOL Power Calculation Formula
 * Haigis W. "The Haigis Formula" — Shammas HJ, ed. IOL Power Calculations. 2004. Ch.41.
 */

const N_AQUEOUS = 1.336;
const N_CORNEA  = 1.3315;   // Haigis cornea index (not 1.3375)
const VERTEX_MM = 12;
const DEFAULT_A1 = 0.4;
const DEFAULT_A2 = 0.1;
const MEAN_ACD   = 3.37;
const MEAN_AL    = 23.39;

export interface HaigisConst { a0: number; a1: number; a2: number }

/** Eq. 41.6 — A-constant → a0 (generic mode, a1=0.4, a2=0.1) */
export function haigisConstFromA(aConst: number): HaigisConst {
  const acdConst = 0.62467 * aConst - 68.747;
  const a0 = acdConst - (DEFAULT_A1 * MEAN_ACD + DEFAULT_A2 * MEAN_AL);
  return { a0, a1: DEFAULT_A1, a2: DEFAULT_A2 };
}

export interface HaigisRow   { power: number; ref: number }

export interface HaigisResult {
  p_emmetropia: number;
  table: HaigisRow[];
  elp: number;
}

function elp(c: HaigisConst, acd: number, al: number) {
  return c.a0 + c.a1 * acd + c.a2 * al;   // Eq. 41.3
}

function cornealPower(kMean: number) {
  const R  = 337.5 / kMean;
  const DC = ((N_CORNEA - 1) / R) * 1000;
  return { R, DC };
}

function rxAtCornea(rxSpec: number, vMm = VERTEX_MM) {
  const v = vMm / 1000;
  return rxSpec / (1 - v * rxSpec);
}

function rxAtSpec(rxCornea: number, vMm = VERTEX_MM) {
  const v = vMm / 1000;
  return rxCornea / (1 + v * rxCornea);
}

function iolPower(al: number, d: number, DC: number, rxCornea: number) {
  const n   = N_AQUEOUS;
  const ALm = al / 1000;
  const dm  = d  / 1000;
  const V1  = rxCornea + DC;
  const V2  = V1 / (1 - (dm / n) * V1);
  const V3  = n  / (ALm - dm);
  return V3 - V2;
}

function expectedRxCornea(al: number, d: number, DC: number, P: number) {
  const n   = N_AQUEOUS;
  const ALm = al / 1000;
  const dm  = d  / 1000;
  const V3  = n  / (ALm - dm);
  const V2  = V3 - P;
  const V1  = V2 / (1 + (dm / n) * V2);
  return V1 - DC;
}

export function calcHaigis(
  al: number, acd: number, k1: number, k2: number,
  target: number, c: HaigisConst,
): HaigisResult | null {
  if (!al || !acd || !k1 || !k2) return null;
  if (al < 15 || al > 40)   return null;
  if (acd < 1.5 || acd > 6) return null;
  if (k1 < 30 || k1 > 60)   return null;
  if (k2 < 30 || k2 > 60)   return null;

  const kMean = (k1 + k2) / 2;
  const { DC } = cornealPower(kMean);
  const d = elp(c, acd, al);
  if (d < 2 || d > 7.5) return null;

  const rxCornea = rxAtCornea(target);
  const P = iolPower(al, d, DC, rxCornea);

  const base = Math.round(P * 2) / 2;
  const table: HaigisRow[] = [];
  for (const step of [1.5, 1.0, 0.5, 0.0, -0.5, -1.0, -1.5]) {
    const pw = base + step;
    const zc = expectedRxCornea(al, d, DC, pw);
    const rs = rxAtSpec(zc);
    table.push({ power: Math.round(pw * 100) / 100, ref: Math.round(rs * 100) / 100 });
  }

  // p_emmetropia — строка ближайшая к target
  const emRow = table.reduce((best, row) =>
    Math.abs(row.ref - target) < Math.abs(best.ref - target) ? row : best
  );

  return { p_emmetropia: emRow.power, table, elp: Math.round(d * 100) / 100 };
}
