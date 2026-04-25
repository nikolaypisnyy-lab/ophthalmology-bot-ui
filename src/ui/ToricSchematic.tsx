import React from 'react';
import { F } from '../constants/design';

interface Props {
  eye: 'od' | 'os';
  incisionAx?: number | null;
  toricAx?: number | null;
  steepAx?: number | null;
  size?: number;
}

export function ToricSchematic({ eye, incisionAx, toricAx, steepAx, size = 240 }: Props) {
  const cx   = size / 2;
  const cy   = size / 2;
  const limR = size * 0.36;
  const oR   = size * 0.195;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const px = (deg: number, r: number) => cx + r * Math.cos(toRad(deg));
  const py = (deg: number, r: number) => cy - r * Math.sin(toRad(deg));

  const temporal = eye === 'od' ? 'Temporal' : 'Nasal';
  const nasal    = eye === 'od' ? 'Nasal'    : 'Temporal';
  const uid = eye;

  // ── Гаптика Alcon-style: одна кривая Безье из двух сегментов ──
  // Выходит из оптики на 135°/225° (лево) или 45°/315° (право),
  // широко огибает с двумя контрольными точками, возвращается обратно.
  const hapticPath = (side: 1 | -1): string => {
    // Точки выхода из оптики (симметрично вокруг 180° для лево, вокруг 0° для право)
    const exitAng  = side === -1 ? 135 : 45;
    const entryAng = side === -1 ? 225 : 315;

    const ex = cx + oR * Math.cos(toRad(exitAng));
    const ey = cy - oR * Math.sin(toRad(exitAng));
    const nx = cx + oR * Math.cos(toRad(entryAng));
    const ny = cy - oR * Math.sin(toRad(entryAng));

    // Контрольные точки — тянут кривую широко в сторону
    const pull = side * oR * 1.72;   // насколько далеко уходит гаптика
    const vert = oR * 1.02;          // вертикальный разброс контрольных точек

    const c1x = cx + pull;  const c1y = cy - vert;   // верхний контроль
    const c2x = cx + pull;  const c2y = cy + vert;   // нижний контроль

    // Один кубический безье — чистый C-loop
    return `M ${ex} ${ey} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${nx} ${ny}`;
  };

  const iolRot = toricAx != null ? -toricAx : 0;

  // ── Наконечник стрелки ──
  const arrowLen = limR * 0.80;
  const arrowTip = (deg: number, s: number) => {
    const tip = { x: px(deg, arrowLen), y: py(deg, arrowLen) };
    const rad  = toRad(deg);
    const w    = s * 0.036;
    const l    = s * 0.062;
    const bx   = tip.x - l * Math.cos(rad);
    const by   = tip.y + l * Math.sin(rad);
    const wx   = w * Math.sin(rad);
    const wy   = w * Math.cos(rad);
    return `${tip.x},${tip.y} ${bx + wx},${by + wy} ${bx - wx},${by - wy}`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`bg_${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1a2535" />
          <stop offset="100%" stopColor="#0a1018" />
        </radialGradient>
        <radialGradient id={`op_${uid}`} cx="38%" cy="32%" r="65%">
          <stop offset="0%"   stopColor="#f0f6ff" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#c7dcf8" stopOpacity="0.86" />
        </radialGradient>
        <filter id={`gl_${uid}`}>
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── ФОН ── */}
      <circle cx={cx} cy={cy} r={limR + 6} fill={`url(#bg_${uid})`} />

      {/* Концентрические кольца радужки */}
      {[0.92, 0.76].map((f, i) => (
        <circle key={i} cx={cx} cy={cy} r={limR * f}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      ))}

      {/* ── ШКАЛА 8 меток ── */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <g key={deg}>
          <line
            x1={px(deg, limR - size * 0.052)} y1={py(deg, limR - size * 0.052)}
            x2={px(deg, limR)}                 y2={py(deg, limR)}
            stroke="rgba(255,255,255,0.55)" strokeWidth={1.8}
          />
          <text
            x={px(deg, limR + size * 0.072)} y={py(deg, limR + size * 0.072)}
            textAnchor="middle" dominantBaseline="central"
            fill="rgba(255,255,255,0.6)" fontSize={size * 0.046}
            fontFamily={F.mono} fontWeight={700}
          >{deg}°</text>
        </g>
      ))}

      {/* Temporal / Nasal */}
      <text x={px(180, limR + size * 0.155)} y={py(180, limR + size * 0.155)}
        textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.5)" fontSize={size * 0.043}
        fontFamily={F.sans} fontWeight={700}>{temporal}</text>
      <text x={px(0, limR + size * 0.155)} y={py(0, limR + size * 0.155)}
        textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.5)" fontSize={size * 0.043}
        fontFamily={F.sans} fontWeight={700}>{nasal}</text>

      {/* ── ЛИМБ ── */}
      <circle cx={cx} cy={cy} r={limR}
        fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth={2} />

      {/* ── КРУТОЙ МЕРИДИАН (синяя линия) ── */}
      {steepAx != null && [steepAx, steepAx + 180].map(d => (
        <line key={d}
          x1={px(d, limR * 0.70)} y1={py(d, limR * 0.70)}
          x2={px(d, limR * 0.92)} y2={py(d, limR * 0.92)}
          stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round"
        />
      ))}

      {/* ── РАЗРЕЗ ХИРУРГА ── */}
      {incisionAx != null && (() => {
        const s = 12;
        const ro = limR + 2, ri = limR - size * 0.06;
        return (
          <path
            d={`M ${px(incisionAx-s,ro)} ${py(incisionAx-s,ro)}
                A ${ro} ${ro} 0 0 0 ${px(incisionAx+s,ro)} ${py(incisionAx+s,ro)}
                L ${px(incisionAx+s,ri)} ${py(incisionAx+s,ri)}
                A ${ri} ${ri} 0 0 1 ${px(incisionAx-s,ri)} ${py(incisionAx-s,ri)} Z`}
            fill="rgba(245,158,11,0.22)" stroke="#f59e0b" strokeWidth={1.5}
          />
        );
      })()}

      {/* ── ТОРИЧЕСКАЯ ИОЛ ── */}
      {toricAx != null && (
        <g transform={`rotate(${iolRot}, ${cx}, ${cy})`}>

          {/* Гаптики — Alcon C-loop (кубический безье) */}
          <path d={hapticPath(-1)}
            fill="none"
            stroke="rgba(180,210,255,0.75)"
            strokeWidth={size * 0.048}
            strokeLinecap="round"
          />
          <path d={hapticPath(1)}
            fill="none"
            stroke="rgba(180,210,255,0.75)"
            strokeWidth={size * 0.048}
            strokeLinecap="round"
          />

          {/* Оптика поверх гаптик */}
          <circle cx={cx} cy={cy} r={oR}
            fill={`url(#op_${uid})`}
            stroke="rgba(100,160,255,0.55)" strokeWidth={size * 0.012} />

          {/* Зональное кольцо */}
          <circle cx={cx} cy={cy} r={oR * 0.68}
            fill="none" stroke="rgba(100,160,255,0.14)" strokeWidth={0.8} />

          {/* 3 метки на правом полюсе — вдоль оси (горизонтально в локальном пространстве) */}
          {[-1, 0, 1].map(i => (
            <circle key={`R${i}`}
              cx={cx + oR - size * 0.01 + i * size * 0.027}
              cy={cy}
              r={size * 0.015}
              fill="#1a1a2e"
              stroke="rgba(255,255,255,0.5)" strokeWidth={0.8}
            />
          ))}
          {/* 3 метки на левом полюсе */}
          {[-1, 0, 1].map(i => (
            <circle key={`L${i}`}
              cx={cx - oR + size * 0.01 - i * size * 0.027}
              cy={cy}
              r={size * 0.015}
              fill="#1a1a2e"
              stroke="rgba(255,255,255,0.5)" strokeWidth={0.8}
            />
          ))}

          {/* Блик */}
          <ellipse cx={cx - oR * 0.26} cy={cy - oR * 0.28}
            rx={oR * 0.2} ry={oR * 0.09}
            fill="rgba(255,255,255,0.28)"
            transform={`rotate(-30, ${cx - oR * 0.26}, ${cy - oR * 0.28})`}
          />
        </g>
      )}

      {/* ── СТРЕЛКА ОСИ ИМПЛАНТАЦИИ ── */}
      {toricAx != null && (
        <g filter={`url(#gl_${uid})`}>
          <line
            x1={px(toricAx, arrowLen)}       y1={py(toricAx, arrowLen)}
            x2={px(toricAx + 180, arrowLen)} y2={py(toricAx + 180, arrowLen)}
            stroke="#f59e0b" strokeWidth={2}
          />
          <polygon points={arrowTip(toricAx,       size)} fill="#f59e0b" />
          <polygon points={arrowTip(toricAx + 180, size)} fill="#f59e0b" />

          {/* Угол в центре оптики */}
          <text x={cx} y={cy}
            textAnchor="middle" dominantBaseline="central"
            fill="#0f1824" fontSize={size * 0.088}
            fontFamily={F.sans} fontWeight={900}
          >{Math.round(toricAx)}°</text>
        </g>
      )}

      {/* Placeholder */}
      {toricAx == null && (
        <>
          <circle cx={cx} cy={cy} r={oR}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
            fill="rgba(255,255,255,0.18)" fontSize={size * 0.05} fontFamily={F.sans}>CALC</text>
        </>
      )}
    </svg>
  );
}
