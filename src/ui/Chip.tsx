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
        borderRadius: 999,
        border: `1px solid ${active ? 'transparent' : C.border}`,
        background: active ? color + '20' : C.surface,
        color: active ? color : C.secondary,
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
