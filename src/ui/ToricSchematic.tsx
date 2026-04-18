import React from 'react';
import { C, F } from '../constants/design';

interface Props {
  eye: 'od' | 'os';
  /** Ось разреза хирурга (0–180°) */
  incisionAx?: number | null;
  /** Ось торической ИОЛ (0–180°) */
  toricAx?: number | null;
  size?: number;
}

/**
 * SVG-схема глаза в стиле OphthalmoCRM (Premium).
 * Фикс: уменьшен радиус лимба, чтобы все метки (90, 270) влезли в границы SVG.
 */
export function ToricSchematic({ eye, incisionAx, toricAx, size = 200 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35; // Уменьшено до 0.35, чтобы влезли внешние лейблы
  const iolR = size * 0.19;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const polarX = (deg: number, radius: number) => cx + radius * Math.cos(toRad(deg));
  const polarY = (deg: number, radius: number) => cy - radius * Math.sin(toRad(deg));

  // Шкала по образцу 45-градусная
  const ticks = [0, 45, 90, 135, 180, 225, 270, 315];
  
  const leftLabel = eye === 'od' ? 'N' : 'T';
  const rightLabel = eye === 'od' ? 'T' : 'N';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="eyeBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2a3f3f" />
          <stop offset="85%" stopColor="#1a2525" />
          <stop offset="100%" stopColor="#0a0a14" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Фон и Лимб */}
      <circle cx={cx} cy={cy} r={r + 10} fill="url(#eyeBg)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2} />

      {/* Градусная шкала (сдвинута ближе к центру) */}
      {ticks.map(d => (
        <g key={d}>
          <line
            x1={polarX(d, r)} y1={polarY(d, r)}
            x2={polarX(d, r - 6)} y2={polarY(d, r - 6)}
            stroke="#fff" strokeWidth={1.5} opacity={0.6}
          />
          <text
            x={polarX(d, r + 15)} y={polarY(d, r + 15)}
            textAnchor="middle" dominantBaseline="central"
            fill="rgba(255,255,255,0.7)" fontSize={11} fontFamily={F.mono} fontWeight={700}
          >
            {d}
          </text>
        </g>
      ))}

      {/* Навигация ОМ/ОН (сдвинута к краям) */}
      <text x={8} y={cy} textAnchor="start" dominantBaseline="central" fill="#fff" fontSize={16} fontWeight={900} fontFamily={F.sans} opacity={0.6}>{leftLabel}</text>
      <text x={size - 8} y={cy} textAnchor="end" dominantBaseline="central" fill="#fff" fontSize={16} fontWeight={900} fontFamily={F.sans} opacity={0.6}>{rightLabel}</text>

      {/* Торическая ИОЛ */}
      {toricAx != null && (
        <g transform={`rotate(${-toricAx}, ${cx}, ${cy})`}>
          {/* Массивная гаптика */}
          <path
            d={`M ${cx - iolR + 1} ${cy - 8} Q ${cx - iolR - 18} ${cy - 22}, ${cx - iolR - 25} ${cy + 15}`}
            fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={5} strokeLinecap="round"
          />
          <path
            d={`M ${cx + iolR - 1} ${cy + 8} Q ${cx + iolR + 18} ${cy + 22}, ${cx + iolR + 25} ${cy - 15}`}
            fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={5} strokeLinecap="round"
          />
          
          {/* Тело линзы */}
          <circle cx={cx} cy={cy} r={iolR} fill="#fff" stroke="rgba(0,0,0,0.1)" strokeWidth={1} />
          
          {/* Координатные точки вдоль оси */}
          {[6, 13, 20].map(offset => (
            <React.Fragment key={offset}>
              <circle cx={cx - iolR + offset} cy={cy} r={2.5} fill="#fbbf24" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
              <circle cx={cx + iolR - offset} cy={cy} r={2.5} fill="#fbbf24" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
            </React.Fragment>
          ))}
        </g>
      )}

      {/* Разрез */}
      {incisionAx != null && (
        <g>
          <path
            d={`M ${polarX(incisionAx-12, r)} ${polarY(incisionAx-12, r)} A ${r} ${r} 0 0 ${incisionAx < 180 ? 0 : 1} ${polarX(incisionAx+12, r)} ${polarY(incisionAx+12, r)} L ${polarX(incisionAx+9, r-16)} ${polarY(incisionAx+9, r-16)} A ${r-16} ${r-16} 0 0 ${incisionAx < 180 ? 1 : 0} ${polarX(incisionAx-9, r-16)} Z`}
            fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth={2.5}
          />
        </g>
      )}

      {/* Красная ось (максимальный контраст) */}
      {toricAx != null && (
        <g filter="url(#glow)">
          <line
            x1={polarX(toricAx, r)} y1={polarY(toricAx, r)}
            x2={polarX(toricAx + 180, r)} y2={polarY(toricAx + 180, r)}
            stroke="#fff" strokeWidth={5} strokeLinecap="round"
          />
          <line
            x1={polarX(toricAx, r)} y1={polarY(toricAx, r)}
            x2={polarX(toricAx + 180, r)} y2={polarY(toricAx + 180, r)}
            stroke="#ef4444" strokeWidth={3} strokeLinecap="round"
          />
          {/* Шильдик с углом */}
          <rect x={cx - 24} y={cy - 12} width={48} height={24} rx={12} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize={14} fontFamily={F.mono} fontWeight={900}
          >
            {toricAx}°
          </text>
        </g>
      )}
    </svg>
  );
}
