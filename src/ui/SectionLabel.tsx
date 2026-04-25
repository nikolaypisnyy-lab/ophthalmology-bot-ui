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
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: mb !== undefined ? mb : (mini ? 8 : 12),
        gap: 10,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: F.mono,
          fontSize: mini ? 9 : 10,
          fontWeight: 700,
          color: color ?? C.muted2,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          opacity: 0.9
        }}>
          {children}
        </span>
        {active && (
          <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: color ?? C.indigo,
            boxShadow: `0 0 8px ${color ?? C.indigo}`
          }} />
        )}
      </div>
      
      <div style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, ${C.border} 0%, transparent 100%)`,
        marginLeft: 12
      }} />
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
