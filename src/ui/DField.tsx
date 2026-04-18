import React, { useState } from 'react';
import { C, F } from '../constants/design';

interface DFieldProps {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: 'text' | 'number';
  unit?: string;
  placeholder?: string;
  step?: string | number;
  readOnly?: boolean;
  fw?: number;
  mini?: boolean;
  accentColor?: string;   // кастомный цвет метки и рамки (OD/OS)
  customBg?: string;      // полностью кастомный фон
  textColor?: string;
}

export function DField({
  label,
  value,
  onChange,
  type = 'text',
  unit,
  placeholder,
  step,
  readOnly,
  fw = 500,
  mini,
  accentColor,
  customBg,
  textColor,
}: DFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasVal =
    value !== undefined &&
    value !== '' &&
    value !== '0.00' &&
    value !== '0';

  const labelColor = accentColor ?? C.muted;

  const bg = customBg
    ? customBg
    : focused
    ? 'linear-gradient(160deg,rgba(129,140,248,.22) 0%,rgba(129,140,248,.1) 55%,rgba(67,56,202,.15) 100%)'
    : 'linear-gradient(160deg,#2a2d3e 0%,#1f2436 50%,#181c2a 100%)';

  const borderColor = accentColor
    ? accentColor + '40'
    : focused
    ? 'rgba(129,140,248,.5)'
    : 'rgba(255,255,255,.12)';

  const borderTopColor = accentColor
    ? accentColor + '80'
    : focused
    ? 'rgba(129,140,248,.65)'
    : 'rgba(255,255,255,.18)';

  const boxShadow = customBg
    ? 'none'
    : focused
    ? `inset 0 1px 0 rgba(255,255,255,.12),inset 0 -1px 0 rgba(0,0,0,.2),0 0 0 2px rgba(129,140,248,.18),0 1px 2px rgba(0,0,0,.2)`
    : `inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.2),0 1px 2px rgba(0,0,0,.2)`;

  const inputColor = textColor
    ? textColor
    : accentColor
    ? accentColor
    : focused
    ? C.accent
    : hasVal
    ? C.text
    : C.muted2;

  const textShadow = accentColor
    ? 'none'
    : focused
    ? '0 0 8px rgba(129,140,248,.4)'
    : '0 1px 2px rgba(0,0,0,.4)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: mini ? 1 : 3,
        minWidth: 0,
        flex: mini ? 1 : undefined,
      }}
    >
      <label
        style={{
          fontFamily: F.sans,
          fontSize: mini ? 7 : 8,
          fontWeight: 800,
          color: labelColor,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingLeft: 2,
        }}
      >
        {label}
      </label>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: mini ? 1 : undefined,
          background: bg,
          border: `1px solid ${borderColor}`,
          borderTopColor,
          borderRadius: 20,
          overflow: 'hidden',
          minWidth: 0,
          transition: 'all .15s',
          boxShadow,
        }}
      >
        <input
          type={type}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder ?? '—'}
          step={step}
          readOnly={readOnly}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            fontFamily: F.mono,
            fontSize: mini ? 10 : 11,
            fontWeight: fw,
            color: inputColor,
            border: 'none',
            outline: 'none',
            padding: mini ? '3px 4px' : '6px 4px',
            flex: 1,
            background: 'transparent',
            minWidth: 0,
            width: 0,
            textAlign: 'center',
            textShadow,
          }}
        />
        {unit && (
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 9,
              color: accentColor ?? C.muted,
              paddingRight: 5,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
