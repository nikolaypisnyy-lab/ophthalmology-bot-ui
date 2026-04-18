import React from 'react';
import { C, F } from '../constants/design';

interface SectionLabelProps {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
  mini?: boolean;
  mb?: number;
  active?: boolean;
  onClick?: () => void;
}

export function SectionLabel({ children, color, style, mini, mb, active, onClick }: SectionLabelProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: mb !== undefined ? mb : (mini ? 4 : 10),
        background: active ? `${color ?? C.accent}15` : 'transparent',
        padding: active ? '4px 8px' : '0',
        marginLeft: active ? -8 : 0,
        borderRadius: 6,
        transition: 'all 0.2s',
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: F.sans,
          fontSize: mini ? 9 : 11,
          fontWeight: mini ? 700 : 800,
          color: color ?? C.muted,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {children}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          background: color 
            ? `linear-gradient(90deg, ${color}60 0%, ${color}20 50%, transparent 100%)` 
            : `linear-gradient(90deg, rgba(255,255,255,.12) 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}

interface DividerProps {
  my?: number;
  color?: string;
}

export function Divider({ my = 16, color }: DividerProps) {
  return (
    <div
      style={{
        height: 1,
        background: color ?? C.border,
        margin: `${my}px 0`,
      }}
    />
  );
}
