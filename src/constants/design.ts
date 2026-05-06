/** Цветовые токены RefMaster 2.0 — тема меняется через setAppTheme() */

const DARK = {
  bg:           '#0d0f1a',
  surface:      '#151828',
  surface2:     'rgba(255,255,255,0.03)',
  surface3:     '#1e2238',
  surfaceActive:'rgba(129,140,248,0.12)',
  card:         '#1e2238',
  cardHi:       '#262b45',
  bgHi:         '#0d0f1a',

  border:  'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.12)',

  text:      '#e4e7f1',
  primary:   '#e4e7f1',
  secondary: '#9ca3b8',
  tertiary:  '#6b7388',
  muted:     '#9ca3b8',
  muted2:    '#6b7388',
  muted3:    '#4b5563',

  indigo:     '#818cf8',
  indigoDim:  'rgba(129,140,248,0.12)',
  indigoGlow: 'rgba(129,140,248,0.28)',
  accent:     '#818cf8',
  accentLt:   'rgba(129,140,248,0.12)',
  accentGlow: 'rgba(129,140,248,0.28)',
  cat:        '#818cf8',

  od:       '#3b82f6',
  odLt:     'rgba(59,130,246,0.14)',
  odBorder: 'rgba(59,130,246,0.35)',
  os:       '#10b981',
  osLt:     'rgba(16,185,129,0.14)',
  osBorder: 'rgba(16,185,129,0.35)',

  success: '#10b981',
  warn:    '#f59e0b',
  danger:  '#ef4444',
  info:    '#38bdf8',
  green:   '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
  purple:  '#a78bfa',
  slate:   '#cbd5e1',
};

const LIGHT = {
  bg:           '#f0f2f8',
  surface:      '#ffffff',
  surface2:     'rgba(0,0,0,0.04)',
  surface3:     '#e8eaf4',
  surfaceActive:'rgba(92,110,247,0.10)',
  card:         '#ffffff',
  cardHi:       '#f0f1fa',
  bgHi:         '#e8eaf4',

  border:  'rgba(0,0,0,0.08)',
  border2: 'rgba(0,0,0,0.14)',

  text:      '#1a1d2e',
  primary:   '#1a1d2e',
  secondary: '#4b5470',
  tertiary:  '#7b82a8',
  muted:     '#4b5470',
  muted2:    '#7b82a8',
  muted3:    '#a8aec8',

  indigo:     '#5c6ef7',
  indigoDim:  'rgba(92,110,247,0.10)',
  indigoGlow: 'rgba(92,110,247,0.20)',
  accent:     '#5c6ef7',
  accentLt:   'rgba(92,110,247,0.10)',
  accentGlow: 'rgba(92,110,247,0.20)',
  cat:        '#5c6ef7',

  od:       '#2563eb',
  odLt:     'rgba(37,99,235,0.10)',
  odBorder: 'rgba(37,99,235,0.30)',
  os:       '#059669',
  osLt:     'rgba(5,150,105,0.10)',
  osBorder: 'rgba(5,150,105,0.30)',

  success: '#059669',
  warn:    '#d97706',
  danger:  '#dc2626',
  info:    '#0284c7',
  green:   '#059669',
  red:     '#dc2626',
  amber:   '#d97706',
  purple:  '#8b5cf6',
  slate:   '#1e293b',
};

type Colors = typeof DARK;

type Theme = 'light' | 'dark';

// Читается из localStorage сразу при загрузке модуля
let _theme: Theme = (() => { try { return (localStorage.getItem('rm_theme') as Theme) || 'light'; } catch { return 'light'; } })();

/** Вызывается из useClinicStore.setTheme() перед Zustand set() */
export function setAppTheme(theme: Theme) {
  _theme = theme;
}

/** Proxy: читает из текущей темы при каждом обращении (работает при ре-рендере) */
export const C = new Proxy({} as Colors, {
  get(_, key: string) {
    return (_theme === 'dark' ? DARK : LIGHT)[key as keyof Colors];
  },
});

/** Шрифты */
export const F = {
  sans: "'DM Sans', system-ui, sans-serif",
  mono: "'DM Mono', monospace",
} as const;

/** Радиусы */
export const R = {
  xs:   6,
  sm:   8,
  md:   10,
  lg:   12,
  xl:   14,
  xxl:  20,
  full: 999,
} as const;

/** Отступы */
export const S = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  huge: 32,
} as const;

/** Цвета по глазу */
export function eyeColors(eye: 'od' | 'os') {
  return eye === 'od'
    ? { color: C.od, bg: C.odLt, bgActive: 'rgba(59,130,246,0.25)', border: C.odBorder }
    : { color: C.os, bg: C.osLt, bgActive: 'rgba(16,185,129,0.25)', border: C.osBorder };
}

/** Цвета по типу пациента */
export function typeColors(type: 'refraction' | 'cataract') {
  return type === 'cataract'
    ? { bg: C.accentLt, color: C.indigo }
    : { bg: 'rgba(167,139,250,0.10)', color: '#a78bfa' };
}

/** Цвета индикатора безопасности */
export const safetyColor = {
  green:  { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', border: 'rgba(16,185,129,0.3)'  },
  yellow: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)'  },
  red:    { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)'   },
} as const;

export type SafetyLevel = keyof typeof safetyColor;
