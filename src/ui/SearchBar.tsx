import React from 'react';
import { C, F } from '../constants/design';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Поиск пациента',
}: SearchBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: '9px 14px',
        flex: 1,
      }}
    >
      <svg
        width="13" height="13"
        fill="none" viewBox="0 0 24 24"
        stroke={C.muted} strokeWidth="2.5"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: F.sans,
          fontSize: 13,
          color: C.text,
          flex: 1,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: C.muted,
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
