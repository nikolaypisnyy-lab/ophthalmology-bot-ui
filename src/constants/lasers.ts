import type { LaserType } from '../types/refraction';

export interface LaserConfig {
  id: LaserType;
  label: string;
  shortLabel: string;
  isLenticule: boolean; // SMILE / RELEX — лентикула, не абляция
  supportsHyperopia: boolean;
  defaultOZ: number;    // оптическая зона по умолчанию, мм
  defaultCap?: number;  // толщина кэпа, мкм (только lenticule)
  defaultFlap?: number; // толщина флэпа, мкм (LASIK)
  ablDepthMod: number;  // модификатор глубины абляции (1.0 = без изменений)
  color: string;        // акцентный цвет в UI
}

export const LASERS: LaserConfig[] = [
  {
    id: 'visx_s4ir',
    label: 'VISX Star S4 IR',
    shortLabel: 'VISX S4',
    isLenticule: false,
    supportsHyperopia: true,
    defaultOZ: 6.5,
    defaultFlap: 110,
    ablDepthMod: 0.83,
    color: '#818cf8',
  },
  {
    id: 'ex500',
    label: 'WaveLight EX500',
    shortLabel: 'EX500',
    isLenticule: false,
    supportsHyperopia: true,
    defaultOZ: 6.5,
    defaultFlap: 110,
    ablDepthMod: 0.90,
    color: '#60a5fa',
  },
  {
    id: 'visumax_800',
    label: 'VisuMax 800 (SMILE)',
    shortLabel: 'VisuMax 800',
    isLenticule: true,
    supportsHyperopia: false,
    defaultOZ: 6.5,
    defaultCap: 120,
    ablDepthMod: 1.0,
    color: '#34d399',
  },
  {
    id: 'visumax_500',
    label: 'VisuMax 500 (SMILE)',
    shortLabel: 'VisuMax 500',
    isLenticule: true,
    supportsHyperopia: false,
    defaultOZ: 6.5,
    defaultCap: 120,
    ablDepthMod: 1.0,
    color: '#2dd4bf',
  },
  {
    id: 'smartsight',
    label: 'SmartSight (CLEAR)',
    shortLabel: 'SmartSight',
    isLenticule: true,
    supportsHyperopia: false,
    defaultOZ: 6.5,
    defaultCap: 120,
    ablDepthMod: 1.0,
    color: '#a78bfa',
  },
  {
    id: 'mel90',
    label: 'MEL 90',
    shortLabel: 'MEL 90',
    isLenticule: false,
    supportsHyperopia: true,
    defaultOZ: 6.5,
    defaultFlap: 110,
    ablDepthMod: 1.0,
    color: '#f59e0b',
  },
  {
    id: 'silk',
    label: 'SILK (ELEx)',
    shortLabel: 'SILK',
    isLenticule: true,
    supportsHyperopia: false,
    defaultOZ: 6.5,
    defaultCap: 100,
    ablDepthMod: 1.0,
    color: '#fb923c',
  },
];

export function getLaser(id: LaserType): LaserConfig {
  return LASERS.find(l => l.id === id) ?? LASERS[0];
}
