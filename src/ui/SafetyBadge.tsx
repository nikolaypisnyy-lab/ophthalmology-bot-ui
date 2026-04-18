import React from 'react';
import { F, safetyColor } from '../constants/design';
import type { SafetyLevel } from '../constants/design';

interface SafetyBadgeProps {
  label: string;
  value: string | number | null;
  unit?: string;
  level: SafetyLevel;
  hint?: string; // подсказка (норма)
}

export function SafetyBadge({
  label,
  value,
  unit,
  level,
  hint,
}: SafetyBadgeProps) {
  const sc = safetyColor[level];
  const display = value !== null && value !== undefined ? String(value) : '—';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        background: sc.bg,
        border: `1px solid ${sc.border}`,
        borderRadius: 12,
        padding: '8px 6px',
        minWidth: 0,
        flex: 1,
      }}
    >
      <span
        style={{
          fontFamily: F.sans,
          fontSize: 8,
          fontWeight: 800,
          color: sc.color,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          opacity: 0.8,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontFamily: F.mono,
          fontSize: 15,
          fontWeight: 700,
          color: sc.color,
          lineHeight: 1,
        }}
      >
        {display}
        {unit && value !== null && (
          <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 2 }}>{unit}</span>
        )}
      </span>

      {hint && (
        <span
          style={{
            fontFamily: F.sans,
            fontSize: 8,
            color: sc.color,
            opacity: 0.55,
            textAlign: 'center',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
