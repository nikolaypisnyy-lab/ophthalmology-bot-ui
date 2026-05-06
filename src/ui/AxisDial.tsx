import React from 'react';
import { C } from '../constants/design';

interface AxisDialProps {
  axis: number | string;
  kAxis?: number | string;
  pAxis?: number | string;
  size?: number;
  color?: string;
  ringWidth?: number;
  tickWidth?: number;
  bg?: string;
  showLabels?: boolean;
}

export function AxisDial({
  axis,
  kAxis,
  pAxis,
  size = 44,
  color,
  ringWidth = 0.5,
  tickWidth = 1.0,
  bg = 'rgba(255,255,255,0.08)',
  showLabels = false,
}: AxisDialProps) {
  const ax = (typeof axis === 'string' ? parseFloat(axis) : axis) + 90;
  const kAx = (kAxis !== undefined) ? (typeof kAxis === 'string' ? parseFloat(kAxis) : kAxis) + 90 : undefined;
  const pAx = (pAxis !== undefined) ? (typeof pAxis === 'string' ? parseFloat(pAxis) : pAxis) + 90 : undefined;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;
  
  const rad = (ax * Math.PI) / 180;
  const dx = -Math.cos(rad) * r;
  const dy = -Math.sin(rad) * r;

  const kRad = (kAx !== undefined) ? (kAx * Math.PI) / 180 : 0;
  const kDx = -Math.cos(kRad) * r;
  const kDy = -Math.sin(kRad) * r;

  const pRad = (pAx !== undefined) ? (pAx * Math.PI) / 180 : 0;
  const pDx = -Math.cos(pRad) * r;
  const pDy = -Math.sin(pRad) * r;
 
  const ticks: React.ReactNode[] = [];
  for (let a = 0; a < 180; a += 45) {
    const ra = (a * Math.PI) / 180;
    const x1 = cx + Math.cos(ra) * (r - 1);
    const y1 = cy - Math.sin(ra) * (r - 1);
    const x2 = cx + Math.cos(ra) * (r + 2);
    const y2 = cy - Math.sin(ra) * (r + 2);
    const x1b = cx - Math.cos(ra) * (r - 1);
    const y1b = cy + Math.sin(ra) * (r - 1);
    const x2b = cx - Math.cos(ra) * (r + 2);
    const y2b = cy + Math.sin(ra) * (r + 2);
    ticks.push(
      <React.Fragment key={a}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={bg} strokeWidth="0.5" />
        <line x1={x1b} y1={y1b} x2={x2b} y2={y2b} stroke={bg} strokeWidth="0.5" />
      </React.Fragment>
    );
  }

  // Метки по стандарту TABO: 0° справа, 45° вверху-справа, 90° сверху, 135° вверху-слева, 180° слева
  const labelData = showLabels ? [
    { svgDeg: 0,   label: '0' },
    { svgDeg: 45,  label: '45' },
    { svgDeg: 90,  label: '90' },
    { svgDeg: 135, label: '135' },
    { svgDeg: 180, label: '180' },
  ] : [];
  const labelR = r + (size < 50 ? 7 : 10);
  const fs = size < 50 ? 5 : 7;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={bg} strokeWidth={ringWidth} />
      {ticks}
      {labelData.map(({ svgDeg, label }) => {
        const rad = (svgDeg * Math.PI) / 180;
        const lx = cx + Math.cos(rad) * labelR;
        const ly = cy - Math.sin(rad) * labelR;
        return (
          <text key={svgDeg} x={lx} y={ly}
            textAnchor="middle" dominantBaseline="central"
            fill={C.muted3} fontSize={fs} fontWeight={700} fontFamily="monospace"
            style={{ userSelect: 'none' }}
          >{label}°</text>
        );
      })}
      
      {/* KERATOMETRY AXIS (SECONDARY AMBER) */}
      {kAx !== undefined && !isNaN(kAx) && (
        <line
          x1={cx - kDx}
          y1={cy - kDy}
          x2={cx + kDx}
          y2={cy + kDy}
          stroke={C.amber}
          strokeWidth={tickWidth}
          strokeLinecap="round"
          opacity="1"
        />
      )}

      {/* PENTACAM AXIS (TERTIARY INDIGO) */}
      {pAx !== undefined && !isNaN(pAx) && (
        <line
          x1={cx - pDx}
          y1={cy - pDy}
          x2={cx + pDx}
          y2={cy + pDy}
          stroke={C.purple}
          strokeWidth={tickWidth}
          strokeLinecap="round"
          opacity="1"
        />
      )}

      {/* REFRACTION AXIS (PRIMARY EYE COLOR) */}
      {!isNaN(ax) && (
        <>
          <line
            x1={cx - dx}
            y1={cy - dy}
            x2={cx + dx}
            y2={cy + dy}
            stroke={color}
            strokeWidth={tickWidth}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="1" fill={color} />
        </>
      )}
    </svg>
  );
}
