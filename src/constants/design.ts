/** Цветовые токены в стиле RefMaster 2.0 Premium */
export const C = {
  // Фоны
  bg:       '#05060c',
  surface:  '#151828',
  surface2: 'rgba(255, 255, 255, 0.03)',
  surface3: '#1e2238',
  surfaceActive: 'rgba(129, 140, 248, 0.12)',

  card:     '#1e2238',
  cardHi:   '#262b45',
  bgHi:     '#0c0e1a',

  // Границы
  border:  'rgba(255, 255, 255, 0.06)',
  border2: 'rgba(255, 255, 255, 0.12)',

  // Текст
  // Text hierarchy
  text:      '#e4e7f1',
  primary:   '#e4e7f1',
  secondary: '#9ca3b8',
  tertiary:  '#6b7388',
  muted:     '#9ca3b8',
  muted2:    '#6b7388',
  muted3:    '#4b5563',

  // Brand accent
  indigo:      '#818cf8',
  indigoDim:   'rgba(129, 140, 248, 0.12)',
  indigoGlow:  'rgba(129, 140, 248, 0.28)',
  accent:      '#818cf8',
  accentLt:    'rgba(129, 140, 248, 0.12)',

  // OD / OS (Premium clinical colors)
  od:       '#3b82f6',
  odLt:     'rgba(59, 130, 246, 0.14)',
  odBorder: 'rgba(59, 130, 246, 0.35)',

  os:       '#10b981',
  osLt:     'rgba(16, 185, 129, 0.14)',
  osBorder: 'rgba(16, 185, 129, 0.35)',

  // Semantic
  success: '#10b981',
  warn:    '#f59e0b',
  danger:  '#ef4444',
  info:    '#38bdf8',
  green:   '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
} as const;

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

/** Отступы (4/8/12/16/20/24/32) */
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
    ? { color: C.od, bg: C.odLt, bgActive: 'rgba(59, 130, 246, 0.25)', border: C.odBorder }
    : { color: C.os, bg: C.osLt, bgActive: 'rgba(16, 185, 129, 0.25)', border: C.osBorder };
}

/** Цвета по типу пациента */
export function typeColors(type: 'refraction' | 'cataract') {
  return type === 'cataract'
    ? { bg: 'rgba(129, 140, 248, 0.10)', color: C.indigo }
    : { bg: 'rgba(167, 139, 250, 0.10)', color: '#a78bfa' };
}

/** Цвета индикатора безопасности */
export const safetyColor = {
  green:  { bg: 'rgba(16, 185, 129, 0.12)',  color: '#10b981', border: 'rgba(16, 185, 129, 0.3)'  },
  yellow: { bg: 'rgba(245, 158, 11, 0.12)',  color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)'  },
  red:    { bg: 'rgba(239, 68, 68, 0.12)',   color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)'   },
} as const;

export type SafetyLevel = keyof typeof safetyColor;

