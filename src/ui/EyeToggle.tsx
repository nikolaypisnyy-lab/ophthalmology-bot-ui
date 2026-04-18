import React from 'react';
import { C, F, eyeColors } from '../constants/design';

interface EyeToggleProps {
  value: 'od' | 'os';
  onChange: (eye: 'od' | 'os') => void;
  size?: 'sm' | 'md';
}

export function EyeToggle({ value, onChange, size = 'md' }: EyeToggleProps) {
  const sm = size === 'sm';

  return (
    <div
      style={{
        display: 'flex',
        background: C.surface2,
        borderRadius: 20,
        padding: 3,
        gap: 2,
        border: `1px solid ${C.border}`,
      }}
    >
      {(['od', 'os'] as const).map(eye => {
        const active = value === eye;
        const ec = eyeColors(eye);
        return (
          <button
            key={eye}
            onClick={() => onChange(eye)}
            style={{
              fontFamily: F.sans,
              fontSize: sm ? 11 : 13,
              fontWeight: 700,
              padding: sm ? '4px 12px' : '6px 16px',
              borderRadius: 17,
              border: 'none',
              cursor: 'pointer',
              transition: 'all .15s',
              background: active ? ec.bgActive : 'transparent',
              color: active ? ec.color : C.muted,
              letterSpacing: '.04em',
              boxShadow: active
                ? `0 0 12px ${ec.color}30`
                : 'none',
            }}
          >
            {eye.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
