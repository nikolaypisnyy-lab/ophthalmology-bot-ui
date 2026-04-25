import React, { useState } from 'react';
import { C, F, R } from '../constants/design';

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
  accentColor?: string;
  customBg?: string;
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
  const hasVal = value !== undefined && value !== '' && value !== '0.00' && value !== '0';

  const borderColor = accentColor && hasVal ? accentColor + '40' : (focused ? C.indigo + '60' : C.border);
  
  const bg = customBg || (focused ? C.surface3 : C.surface);
  
  const labelColor = accentColor && hasVal ? accentColor : C.muted2;
  const inputColor = textColor || (accentColor && hasVal ? accentColor : (focused ? C.indigo : (hasVal ? C.text : C.muted2)));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: mini ? 1 : undefined,
    }}>
      <label style={{
        fontFamily: F.mono,
        fontSize: mini ? 8.5 : 9,
        fontWeight: 600,
        color: labelColor,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        paddingLeft: 4,
        opacity: 0.8
      }}>
        {label}
      </label>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: R.md,
        overflow: 'hidden',
        minWidth: 0,
        transition: 'all .25s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: mini ? '6px 4px' : '10px 6px',
        boxShadow: focused ? `0 0 16px ${C.indigo}15` : 'none',
      }}>
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
            fontSize: mini ? 14 : 16,
            fontWeight: fw,
            color: inputColor,
            border: 'none',
            outline: 'none',
            padding: 0,
            flex: 1,
            background: 'transparent',
            minWidth: 0,
            width: '100%',
            textAlign: 'center',
            transition: 'color .2s',
          }}
        />
        {unit && (
          <span style={{
            fontFamily: F.mono,
            fontSize: mini ? 9 : 10,
            color: C.muted2,
            paddingRight: 6,
            marginLeft: 2,
            opacity: 0.6
          }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
