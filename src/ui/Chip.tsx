import React from 'react';
import { C, F } from '../constants/design';

interface ChipProps {
  label: string;
  active?: boolean;
  color?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Chip({ label, active, color = C.accent, onClick, style }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 20,
        border: `1.5px solid ${active ? color : C.border}`,
        background: active ? color + '25' : 'transparent',
        color: active ? color : C.muted,
        fontFamily: F.sans,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all .15s',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {label}
    </button>
  );
}
