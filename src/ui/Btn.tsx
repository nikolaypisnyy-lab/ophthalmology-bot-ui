import React from 'react';
import { C, F } from '../constants/design';

export type BtnVariant =
  | 'primary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'cat'
  | 'ref'
  | 'green';

interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  small?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
}

const VARIANTS: Record<BtnVariant, React.CSSProperties> = {
  primary: { background: C.accent,  color: '#fff',    boxShadow: `0 2px 16px ${C.accentGlow}` },
  outline: { background: 'transparent', border: `1.5px solid ${C.border2}`, color: C.muted2 },
  ghost:   { background: C.surface2, color: C.text },
  cat:     { background: C.cat + '20', color: C.cat, border: `1px solid ${C.cat}40` },
  ref:     { background: C.ref + '20', color: C.ref, border: `1px solid ${C.ref}40` },
  danger:  { background: C.red + '20', color: C.red, border: `1px solid ${C.red}40` },
  green:   { background: C.green + '20', color: C.green, border: `1px solid ${C.green}40` },
};

export function Btn({
  children,
  onClick,
  variant = 'primary',
  small,
  disabled,
  full,
  style: extraStyle = {},
  type = 'button',
}: BtnProps) {
  const base: React.CSSProperties = {
    fontFamily: F.sans,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 20,
    border: 'none',
    transition: 'all .15s',
    padding: small ? '7px 14px' : '12px 20px',
    fontSize: small ? 12 : 14,
    opacity: disabled ? 0.4 : 1,
    width: full ? '100%' : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...extraStyle,
  };

  return (
    <button
      type={type}
      style={{ ...base, ...VARIANTS[variant] }}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </button>
  );
}
