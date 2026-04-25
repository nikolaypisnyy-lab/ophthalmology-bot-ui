import React, { useState } from 'react';
import { C, F, R } from '../constants/design';
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
  fw = 600,
  mini = false,
  accentText = false,
  textColor,
}: WheelFieldProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const dec = step < 1 ? 2 : 0;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const fmt = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    const showPlus = (unit === 'D' || unit === undefined) && n > 0;
    return (showPlus ? '+' : '') + n.toFixed(dec);
  };

  const handleFinishEdit = () => {
    let n = parseFloat(tempValue);
    if (!isNaN(n)) {
      onChange(n.toFixed(dec));
    }
    setIsEditing(false);
  };

  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: mini ? 1 : undefined,
      }}>
        <label style={{
          fontFamily: F.mono,
          fontSize: mini ? 8.5 : 9,
          fontWeight: 600,
          color: (accentColor && value !== '0.00' && value !== '0') ? accentColor : C.muted2,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          paddingLeft: 4,
          opacity: 0.8
        }}>
          {label}
        </label>

        <div
          onClick={() => {
             // Toggle between picker and keyboard or just focus keyboard?
             // Surgeon preference: click to edit, long press for picker? 
             // Or click on text to edit, click on arrow for picker?
             setIsEditing(true);
             setTempValue(value);
             setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'text',
            minWidth: 0,
            flex: mini ? 1 : undefined,
            background: C.surface,
            border: `1px solid ${isEditing ? (accentColor || C.indigo) : C.border}`,
            borderRadius: R.md,
            padding: mini ? '6px 4px' : '10px 6px',
            transition: 'all 0.2s',
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              value={tempValue}
              onChange={e => setTempValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={e => e.key === 'Enter' && handleFinishEdit()}
              style={{
                width: '100%', background: 'none', border: 'none', textAlign: 'center',
                color: textColor ?? (accentColor || C.text), fontSize: mini ? 14 : 16,
                fontWeight: fw, fontFamily: F.mono, outline: 'none', padding: 0
              }}
            />
          ) : (
            <>
              <span style={{
                fontFamily: F.mono,
                fontSize: mini ? 14 : 16,
                color: textColor ?? (accentText || (accentColor && value !== '0.00' && value !== '0') ? accentColor : C.text),
                fontWeight: fw,
                textAlign: 'center',
                flex: 1,
              }}>
                {fmt(value)}
              </span>
              <div 
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                style={{ fontSize: 9, color: C.muted2, opacity: 0.5, marginLeft: 2, padding: '0 4px', cursor: 'pointer' }}
              >
                ▼
              </div>
            </>
          )}
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
