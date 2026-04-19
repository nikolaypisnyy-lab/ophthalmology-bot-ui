export interface AstigmatismVector {
  x: number;
  y: number;
}

export function fromPolar(magnitude: number, axisDeg: number): AstigmatismVector {
  const rad = (Math.PI / 180) * (2 * axisDeg);
  return { x: magnitude * Math.cos(rad), y: magnitude * Math.sin(rad) };
}

export function toPolar(v: AstigmatismVector): { magnitude: number; axis: number } {
  const magnitude = Math.sqrt(v.x ** 2 + v.y ** 2);
  if (magnitude < 0.0001) return { magnitude: 0, axis: 0 };
  let axis = (Math.atan2(v.y, v.x) * 180) / Math.PI / 2;
  while (axis < 0) axis += 180;
  while (axis >= 180) axis -= 180;
  return { magnitude, axis };
}

export function applyAbulafiaKoch(cyl: number, axis: number, al: number = 23.5): { magnitude: number; axis: number } {
  const v = fromPolar(cyl, axis);
  // Dynamic PCA based on Axial Length
  const pcaBase = 0.38;
  const pcaAdj = pcaBase - 0.015 * (al - 23.5);
  const pcaVal = Math.max(0.20, Math.min(0.50, pcaAdj));

  const xAdj = 0.98 * v.x + pcaVal;
  const yAdj = 0.98 * v.y;
  return toPolar({ x: xAdj, y: yAdj });
}

export function applySIA(cyl: number, axis: number, sia: number, incAxis: number): { magnitude: number; axis: number } {
  const vCornea = fromPolar(cyl, axis);
  const vSia = fromPolar(-sia, incAxis);
  return toPolar({ x: vCornea.x + vSia.x, y: vCornea.y + vSia.y });
}

export interface ToricSuggestion {
  model: string;
  cylIol: number;
  cylCornea: number;
  residual: number;
  resAxis: number;
  isWTR: boolean;
}

export const ALCON_TORIC_MODELS = [
  { model: 'T2', cylIol: 1.00 },
  { model: 'T3', cylIol: 1.50 },
  { model: 'T4', cylIol: 2.25 },
  { model: 'T5', cylIol: 3.00 },
  { model: 'T6', cylIol: 3.75 },
  { model: 'T7', cylIol: 4.50 },
  { model: 'T8', cylIol: 5.25 },
  { model: 'T9', cylIol: 6.00 },
];

export function calculateAutonomousToric(
  k1: number,
  k2: number,
  k1Axis: number,
  sia: number,
  incAxis: number,
  al: number = 23.5
) {
  const cylNet = Math.abs(k2 - k1);
  const steepAxis = k2 > k1 ? (k1Axis + 90) % 180 : k1Axis;

  const adj = applyAbulafiaKoch(cylNet, steepAxis, al);
  const final = applySIA(adj.magnitude, adj.axis, sia, incAxis);

  const vTarget = fromPolar(final.magnitude, final.axis);
  const suggestions: ToricSuggestion[] = ALCON_TORIC_MODELS.map(m => {
    const cCornea = m.cylIol / 1.46;
    const vLens = fromPolar(cCornea, final.axis);
    const vRes = { x: vTarget.x - vLens.x, y: vTarget.y - vLens.y };
    const polarRes = toPolar(vRes);
    const dispResAx = (Math.round(polarRes.axis) + 90) % 180 || 180;
    return {
      model: m.model,
      cylIol: m.cylIol,
      cylCornea: cCornea,
      residual: polarRes.magnitude,
      resAxis: dispResAx,
      isWTR: dispResAx >= 45 && dispResAx <= 135
    };
  });

  // Clinical Preference logic
  const wtrOptions = suggestions.filter(s => s.isWTR && s.residual < 0.6);
  let best = suggestions[0];
  if (wtrOptions.length > 0) {
     best = wtrOptions.reduce((prev, curr) => prev.residual < curr.residual ? prev : curr);
  } else {
     best = suggestions.reduce((prev, curr) => prev.residual < curr.residual ? prev : curr);
  }

  return {
    netCyl: cylNet,
    adjCyl: final.magnitude,
    adjAxis: final.axis,
    bestModel: best.model,
    table: suggestions
  };
}
