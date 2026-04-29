import React from 'react';
import { F } from '../constants/design';

interface Props {
  eye: 'od' | 'os';
  incisionAx: number | null;
  toricAx: number | null;
  steepAx: number | null;
  size?: number;
}

export function ToricSchematic({ eye, incisionAx, toricAx, steepAx, size = 240 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const limR = size * 0.44;
  const oR = size * 0.16; // Slightly smaller

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const px = (deg: number, r: number) => cx + r * Math.cos(toRad(deg));
  const py = (deg: number, r: number) => cy - r * Math.sin(toRad(deg));

  const temporal = eye === 'od' ? 'Temporal' : 'Nasal';
  const nasal = eye === 'od' ? 'Nasal' : 'Temporal';

  const iolRot = toricAx != null ? -toricAx : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* ── LIMBUS ── */}
      <circle cx={cx} cy={cy} r={limR} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />

      {/* ── SCALE ── */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <g key={deg}>
          <line
            x1={px(deg, limR)} y1={py(deg, limR)}
            x2={px(deg, limR + 12)} y2={py(deg, limR + 12)}
            stroke="rgba(255,255,255,0.4)" strokeWidth={2}
          />
          <text
            x={px(deg, limR + 32)} y={py(deg, limR + 32)}
            textAnchor="middle" dominantBaseline="central"
            fill="rgba(255,255,255,0.7)" fontSize={13} fontFamily={F.sans} fontWeight={900}
          >{deg}°</text>
        </g>
      ))}

      {/* ── SIDE LABELS ── */}
      <g transform={`translate(${cx - limR - 55}, ${cy}) rotate(180)`}>
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.3)"
          fontSize={12}
          fontWeight={900}
          style={{ writingMode: 'vertical-rl' }}
        >
          {temporal.toUpperCase().split('').join(' ')}
        </text>
      </g>
      <g transform={`translate(${cx + limR + 55}, ${cy})`}>
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.3)"
          fontSize={12}
          fontWeight={900}
          style={{ writingMode: 'vertical-rl' }}
        >
          {nasal.toUpperCase().split('').join(' ')}
        </text>
      </g>

      {/* ── STEEP MERIDIAN ── */}
      {steepAx != null && [steepAx, steepAx + 180].map(d => (
        <line key={d}
          x1={px(d, limR * 0.72)} y1={py(d, limR * 0.72)}
          x2={px(d, limR * 0.98)} y2={py(d, limR * 0.98)}
          stroke="#3b82f6" strokeWidth={4} strokeLinecap="round"
        />
      ))}

      {/* ── INCISION ── */}
      {incisionAx != null && (
        <path
          d={`M ${px(incisionAx - 18, limR)} ${py(incisionAx - 18, limR)} A ${limR} ${limR} 0 0 0 ${px(incisionAx + 18, limR)} ${py(incisionAx + 18, limR)}`}
          fill="none" stroke="#2563eb" strokeWidth={8} strokeLinecap="round"
        />
      )}

      {/* ── MINIMALIST IOL (Circle with 4 Dots) ── */}
      {toricAx != null && (
        <g transform={`translate(${cx}, ${cy}) rotate(${iolRot})`}>
          <circle cx={0} cy={0} r={oR} fill="#fff" stroke="rgba(0,0,0,0.15)" strokeWidth={0.5} />
          
          {/* 4 Toric Dots at the axis ends */}
          {[oR - 8, oR - 16].map(x => (
            <React.Fragment key={x}>
              <circle cx={x} cy={0} r={2.5} fill="#000" />
              <circle cx={-x} cy={0} r={2.5} fill="#000" />
            </React.Fragment>
          ))}
        </g>
      )}

      {/* ── TORIC AXIS ARROW ── */}
      {toricAx != null && (
        <g>
          <line
            x1={px(toricAx, limR * 0.95)} y1={py(toricAx, limR * 0.95)}
            x2={px(toricAx + 180, limR * 0.95)} y2={py(toricAx + 180, limR * 0.95)}
            stroke="#f97316" strokeWidth={2.5}
          />
          {[toricAx, toricAx + 180].map(d => (
            <polygon key={d} points={`${px(d, limR * 0.95)},${py(d, limR * 0.95)} ${px(d-4, limR * 0.9)},${py(d-4, limR * 0.9)} ${px(d+4, limR * 0.9)},${py(d+4, limR * 0.9)}`} fill="#f97316" />
          ))}

          {/* Central Axis Value */}
          <text 
            x={cx} y={cy} 
            textAnchor="middle" 
            dominantBaseline="central" 
            fill="#000" 
            fontSize={32} 
            fontWeight={900} 
            fontFamily={F.sans}
          >
            {Math.round(toricAx)}°
          </text>
        </g>
      )}

      {toricAx == null && (
        <>
          <circle cx={cx} cy={cy} r={limR * 0.4} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.2)" fontSize={16} fontFamily={F.sans}>CALC</text>
        </>
      )}
    </svg>
  );
}
