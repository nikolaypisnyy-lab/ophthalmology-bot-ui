/** Цветовые токены */
export const C = {
  // Фоны
  bg:       '#0a0d16',
  surface:  '#111420',
  surface2: 'rgba(255,255,255,.03)',
  surface3: '#1f2436',
  surfaceActive: 'rgba(129,140,248,.12)', //Indigo tint for active

  // Границы
  border:  'rgba(255,255,255,.08)',
  border2: 'rgba(255,255,255,.14)',

  // Текст
  text:   'rgba(255,255,255,.92)',
  muted:  'rgba(255,255,255,.30)',
  muted2: 'rgba(255,255,255,.55)',

  // Акцент (indigo)
  accent:     '#818cf8',
  accentLt:   'rgba(129,140,248,.12)',
  accentGlow: 'rgba(129,140,248,.28)',

  // Типы пациентов
  cat:   '#818cf8', catLt:   'rgba(129,140,248,.10)', // Катаракта = indigo
  ref:   '#a78bfa', refLt:   'rgba(167,139,250,.10)', // Рефракция = violet

  // OD / OS (НИКОГДА не меняются)
  od:       '#60a5fa',
  odLt:     'rgba(96,165,250,.10)',
  odBorder: 'rgba(96,165,250,.35)',

  os:       '#34d399',
  osLt:     'rgba(52,211,153,.10)',
  osBorder: 'rgba(52,211,153,.35)',

  // Семантические
  green:   '#34d399', greenLt:  'rgba(52,211,153,.10)',
  red:     '#f87171', redLt:    'rgba(248,113,113,.10)',
  yellow:  '#fbbf24', yellowLt: 'rgba(251,191,36,.10)',
  amber:   '#f59e0b',

  // Навигация
  nav: '#0a0d16',
} as const;

/** Шрифты */
export const F = {
  sans: "'Nunito',sans-serif",
  mono: "'DM Mono',monospace",
} as const;

/** Радиусы */
export const R = {
  xs:  8,
  sm:  12,
  md:  16,
  lg:  20,
  xl:  24,
  full: 9999,
} as const;

/** Отступы */
export const S = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
} as const;

/** Цвета по глазу */
export function eyeColors(eye: 'od' | 'os') {
  return eye === 'od'
    ? { color: C.od, bg: C.odLt, bgActive: 'rgba(30,90,180,.55)', border: C.odBorder }
    : { color: C.os, bg: C.osLt, bgActive: 'rgba(16,120,90,.55)', border: C.osBorder };
}

/** Цвета по типу пациента */
export function typeColors(type: 'refraction' | 'cataract') {
  return type === 'cataract'
    ? { bg: C.catLt, color: C.cat }
    : { bg: C.refLt, color: C.ref };
}

/** Цвета индикатора безопасности */
export const safetyColor = {
  green:  { bg: 'rgba(52,211,153,.12)',  color: '#34d399', border: 'rgba(52,211,153,.3)'  },
  yellow: { bg: 'rgba(251,191,36,.12)',  color: '#fbbf24', border: 'rgba(251,191,36,.3)'  },
  red:    { bg: 'rgba(248,113,113,.12)', color: '#f87171', border: 'rgba(248,113,113,.3)' },
} as const;

export type SafetyLevel = keyof typeof safetyColor;
