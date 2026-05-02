export type LaserType =
  | 'ex500'
  | 'visx_s4ir'
  | 'visumax_800'
  | 'visumax_500'
  | 'smartsight'
  | 'mel90'
  | 'silk';

export type AstigType = 'WTR' | 'ATR' | 'Oblique';
export type AstigSource =
  | 'Pentacam Total'
  | 'Pentacam Ant+Post'
  | 'Pentacam Ant'
  | 'K1/K2'
  | 'Keratometry'
  | 'Субъективно (Манифест)'
  | 'Автореф (Узкий)'
  | 'Циклоплегия (Широкий)'
  | 'Нет данных';

/** Все измерения по одному глазу (рефракция + биометрия роговицы) */
export interface EyeData {
  // Манифест
  man_sph: string;
  man_cyl: string;
  man_ax: string;
  uva: string;   // UCVA
  bcva: string;  // BCVA

  // Узкий зрачок (авторефрактометрия)
  n_sph: string;
  n_cyl: string;
  n_ax: string;
  kavg: string;   // средняя К (авторефрактометр)
  kercyl: string; // роговичный цилиндр
  kerax: string;  // ось роговичного цилиндра

  // Циклоплегия (широкий зрачок)
  c_sph: string;
  c_cyl: string;
  c_ax: string;
  
  // Wide pupil (extra fields for some machines)
  w_sph?: string;
  w_cyl?: string;
  w_ax?: string;

  // Кератометрия
  k1: string;
  k2: string;
  k_ax: string;
  k1_cyl?: string;

  // Pentacam
  p_ant_k: string;  // передняя — Km
  p_ant_c: string;  // передняя — цилиндр
  p_ant_a: string;  // передняя — ось
  p_post_k: string; // задняя — Km
  p_post_c: string; // задняя — цилиндр
  p_post_a: string; // задняя — ось
  p_tot_k: string;  // total — Km
  p_tot_c: string;  // total — цилиндр
  p_tot_a: string;  // total — ось

  // Дополнительно
  cct: string;  // центральная толщина роговицы, мкм
  wtw: string;  // white-to-white, мм
  iop: string;  // ВГД
  acd: string;  // передняя камера (для ref пациентов)
  al: string;   // axial length (ПЗО)
  lt: string;   // lens thickness
}

/** Результат расчёта плана ЛКЗ для одного глаза */
export interface RefractionPlan {
  sph: number;
  cyl: number;
  ax: number;

  astigSrc: AstigSource;
  astigType: AstigType | null;
  astigTarget: string;
  isCompromise: boolean;

  cornCyl: number | null;
  cornAx: number | null;
  dAx: number | null;  // delta axis (разница субъективной и роговичной оси)

  kAstig: { val: string; ax: number | null; src: string } | null;

  bcva: string | null;
  uva: string | null;

  nSph: number | null;
  nCyl: number | null;
  cSph: number | null;
  cCyl: number | null;

  // Alpins vectors
  corCyl: number | null;
  corAx: number | null;
  refrCyl: number | null;
  refrAx: number | null;

  tiaCyl: number | null;
  tiaAx: number | null;
  siaCyl: number | null;
  siaAx: number | null;
  tiaMag: string | null;
  siaMag: string | null;
  dvMag: string | null;

  // ORA
  ora: string | null;
  oraAx: number | null;

  // Alpins metrics
  ci: number | null;   // Correction Index
  me: number | null;   // Magnitude Error
  ae: number | null;   // Angle Error

  deltaWarning?: string | null;
}

/** Показатели безопасности */
export interface RefStats {
  abl: number;          // глубина абляции, мкм
  rsb: number | null;   // Residual Stromal Bed, мкм
  pta: string | null;   // Percent Tissue Altered, %
  kpost: string | null; // постоп кривизна роговицы, D
}

/** Дефолтные значения EyeData */
export function newEyeData(): EyeData {
  return {
    man_sph: '0.00', man_cyl: '0.00', man_ax: '', uva: '', bcva: '',
    n_sph: '0.00', n_cyl: '0.00', n_ax: '', kavg: '', kercyl: '', kerax: '',
    c_sph: '0.00', c_cyl: '0.00', c_ax: '',
    k1: '', k2: '', k_ax: '',
    p_ant_k: '', p_ant_c: '', p_ant_a: '', 
    p_post_k: '', p_post_c: '', p_post_a: '', 
    p_tot_k: '', p_tot_c: '', p_tot_a: '',
    cct: '', wtw: '', iop: '', acd: '', al: '', lt: '',
  };
}
