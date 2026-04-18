import React, { useState } from 'react';
import { C, F } from '../constants/design';
import { WheelPicker } from './WheelPicker';

interface WheelFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  accentColor?: string;
  fw?: number;
  mini?: boolean;
  accentText?: boolean;
  textColor?: string;
}

export function WheelField({
  label,
  value,
  onChange,
  min = -25,
  max = 25,
  step = 0.25,
  unit = 'D',
  accentColor,
  fw = 500,
  mini = false,
  accentText = false,
  textColor,
}: WheelFieldProps) {
  const [open, setOpen] = useState(false);
  const dec = step < 1 ? 2 : 0;

  const fmt = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(dec);
  };

  return (
    <>
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
            color: accentColor ?? C.muted,
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
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            cursor: 'pointer',
            minWidth: 0,
            flex: mini ? 1 : undefined,
            background: 'linear-gradient(160deg,#2a2d3e 0%,#1f2436 50%,#181c2a 100%)',
            border: `1px solid ${accentColor ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.12)'}`,
            borderTopColor: accentColor ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.18)',
            borderRadius: 20,
            padding: mini ? '3px 4px' : '6px 4px',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.2),0 1px 2px rgba(0,0,0,.2)',
          }}
        >
          <span
            style={{
              fontFamily: F.mono,
              fontSize: mini ? 10 : 11,
              color: textColor ?? (accentText ? accentColor : (accentColor ?? C.text)),
              fontWeight: fw,
              flex: 1,
              minWidth: 0,
              textAlign: 'center',
              textShadow: '0 1px 2px rgba(0,0,0,.4)',
            }}
          >
            {fmt(value)}
          </span>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 8,
              color: C.muted,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {open && (
        <WheelPicker
          label={label}
          value={value}
          unit={unit}
          min={min}
          max={max}
          step={step}
          onClose={() => setOpen(false)}
          onConfirm={v => {
            onChange(v.toFixed(dec));
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
