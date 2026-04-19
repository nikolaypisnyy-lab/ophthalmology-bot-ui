import { apiGet, apiPost } from './client';
import type { EyeData } from '../types/refraction';
import type { BiometryData } from '../types/iol';
import type { Patient } from '../types/patient';
import type { PeriodKey } from '../types/results';

// ── Типы сырого ответа от сервера ─────────────────────────────────────────────

export interface RawMeasurements {
  // Рефракция
  manifest?: Record<'od' | 'os', {
    sph?: number; cyl?: number; axis?: number;
    uva?: number; ucva?: number; bcva?: number;
    bcva_rx?: { sph?: number; cyl?: number; axis?: number; va?: number };
    glasses?: { sph?: number; cyl?: number; axis?: number; va?: number };
    glasses_rx?: { sph?: number; cyl?: number; axis?: number; va?: number };
  }>;
  autoref_narrow?: Record<'od' | 'os', {
    sph?: number; cyl?: number; axis?: number;
    kavg?: number; kercyl?: number; kerax?: number;
  }>;
  autoref_cyclo?: Record<'od' | 'os', {
    sph?: number; cyl?: number; axis?: number;
  }>;
  keratometry?: Record<'od' | 'os', {
    k1?: number; k2?: number; kavg?: number; kercyl?: number; axis?: number;
  }>;
  pentacam?: Record<'od' | 'os', {
    ant_cyl?: number; ant_ax?: number;
    post_cyl?: number; post_ax?: number;
    tot_cyl?: number; tot_ax?: number;
  }>;
  pachymetry?: Record<'od' | 'os', { cct?: number }>;
  wtw?: Record<'od' | 'os', { value?: number }>;
  dominant_eye?: { value?: string };

  // Хирургический план (ЛКЗ)
  surgery_plan?: {
    laser_type?: string;
    author?: string;
    plan_tweaked?: boolean;
    optical_zone_mm?: number;
    od?: { sph?: number; cyl?: number; axis?: number; optical_zone?: number };
    os?: { sph?: number; cyl?: number; axis?: number; optical_zone?: number };
    flap?: Record<'od' | 'os', { thickness_um?: number }>;
  };
  nomogram_settings?: {
    useCornealAstig?: boolean;
    roundTo025?: boolean;
    skip_od?: boolean;
    skip_os?: boolean;
  };

  // Биометрия ИОЛ
  axial_length?: Record<'od' | 'os', { value?: number }>;
  acd?: Record<'od' | 'os', { value?: number }>;
  lt?: Record<'od' | 'os', { value?: number }>;

  // Расчёт ИОЛ
  iol_calc?: {
    barrett?: Record<'od' | 'os', unknown>;
    kane?: Record<'od' | 'os', unknown>;
    jnj?: Record<'od' | 'os', unknown>;
    selected_iol?: Record<'od' | 'os', {
      model?: string; power?: number; target?: string;
    }>;
  };

  // Постоп периоды
  periods?: Record<PeriodKey, Record<'od' | 'os', {
    sph?: string; cyl?: string; ax?: string;
    va?: string; bcva?: string;
    k1?: string; k2?: string; k_ax?: string;
    iop?: string; note?: string;
  }>>;
}

export interface MeasurementsResponse {
  status: 'ok' | 'error';
  data?: RawMeasurements;
  visit?: { visit_id: string | number };
  detail?: string;
}

// ── Загрузка измерений ────────────────────────────────────────────────────────

export async function getMeasurements(
  visitId: string,
): Promise<MeasurementsResponse> {
  return apiGet<MeasurementsResponse>(`/measurements/${visitId}`);
}

// ── Маппинг: сырые данные → поля Patient ─────────────────────────────────────

const sf = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  return String(v);
};

/** Заполнить EyeData из RawMeasurements для одного глаза */
export function mapEyeData(m: RawMeasurements, side: 'od' | 'os'): Partial<EyeData> {
  const eye: Partial<EyeData> = {};

  // Манифест
  const man = m.manifest?.[side];
  if (man) {
    const rx = man.bcva_rx ?? man;
    eye.man_sph = sf(rx.sph);
    eye.man_cyl = sf(rx.cyl);
    eye.man_ax  = sf(rx.axis);
    eye.uva  = sf(man.uva ?? man.ucva);
    eye.bcva = sf(man.bcva ?? (rx as any).va);
  }

  // Узкий зрачок
  const nar = m.autoref_narrow?.[side];
  if (nar) {
    eye.n_sph  = sf(nar.sph);
    eye.n_cyl  = sf(nar.cyl);
    eye.n_ax   = sf(nar.axis);
    eye.kavg   = sf(nar.kavg);
    eye.kercyl = sf(nar.kercyl);
    eye.kerax  = sf(nar.kerax);
  }

  // Циклоплегия
  const cyc = m.autoref_cyclo?.[side];
  if (cyc) {
    eye.c_sph = sf(cyc.sph);
    eye.c_cyl = sf(cyc.cyl);
    eye.c_ax  = sf(cyc.axis);
  }

  // Кератометрия
  const ker = m.keratometry?.[side];
  if (ker) {
    eye.k1     = sf(ker.k1);
    eye.k2     = sf(ker.k2);
    eye.kavg   = sf(ker.kavg ?? ((parseFloat(String(ker.k1)) + parseFloat(String(ker.k2))) / 2).toFixed(2));
    eye.kercyl = sf(ker.kercyl);
    eye.kerax  = sf(ker.axis);
  }

  // Pentacam
  const pen = m.pentacam?.[side];
  if (pen) {
    eye.p_ant_c  = sf(pen.ant_cyl);
    eye.p_ant_a  = sf(pen.ant_ax);
    eye.p_post_c = sf(pen.post_cyl);
    eye.p_post_a = sf(pen.post_ax);
    eye.p_tot_c  = sf(pen.tot_cyl);
    eye.p_tot_a  = sf(pen.tot_ax);
  }

  // Пахиметрия / WTW
  eye.cct = sf(m.pachymetry?.[side]?.cct);
  eye.wtw = sf(m.wtw?.[side]?.value);

  return eye;
}

/** Заполнить BiometryData из RawMeasurements для одного глаза */
export function mapBiometryData(m: RawMeasurements, side: 'od' | 'os'): Partial<BiometryData> {
  const bio: Partial<BiometryData> = {};
  bio.al  = sf(m.axial_length?.[side]?.value);
  bio.k1  = sf(m.keratometry?.[side]?.k1);
  bio.k2  = sf(m.keratometry?.[side]?.k2);
  bio.k1_ax = sf(m.keratometry?.[side]?.axis);
  bio.acd = sf(m.acd?.[side]?.value);
  bio.lt  = sf(m.lt?.[side]?.value);
  bio.wtw = sf(m.wtw?.[side]?.value);
  bio.cct = sf(m.pachymetry?.[side]?.cct);
  return bio;
}

// ── Сохранение измерений ──────────────────────────────────────────────────────

export async function saveMeasurements(
  visitId: string,
  patient: Patient,
): Promise<void> {
  const pF = (v: unknown) => {
    const f = parseFloat(String(v));
    return isNaN(f) ? null : f;
  };
  const pI = (v: unknown) => {
    const i = parseInt(String(v));
    return isNaN(i) ? null : i;
  };

  const payload: { data: RawMeasurements } = { data: {} };
  const d = payload.data;

  if (patient.type === 'cataract') {
    // ── Биометрия ИОЛ ─────────────────────────────────────────────────────────
    d.axial_length = {} as any;
    d.keratometry  = {} as any;
    d.acd          = {} as any;
    d.wtw          = {} as any;

    (['od', 'os'] as const).forEach(side => {
      const bio = patient[`bio_${side}` as 'bio_od' | 'bio_os'];
      if (!bio) return;

      if (bio.al)  d.axial_length![side] = { value: pF(bio.al) ?? undefined };
      if (bio.k1 || bio.k2) {
        d.keratometry![side] = {
          k1: pF(bio.k1) ?? undefined,
          k2: pF(bio.k2) ?? undefined,
          axis: pI(bio.k1_ax) ?? undefined,
        };
      }
      if (bio.acd) d.acd![side] = { value: pF(bio.acd) ?? undefined };
      if (bio.wtw) d.wtw![side] = { value: pF(bio.wtw) ?? undefined };
    });

    // ── Постоп периоды (катаракта тоже) ───────────────────────────────────────
    if (patient.periods && Object.keys(patient.periods).length > 0)
      d.periods = patient.periods as any;

    // ── Результат ИОЛ расчёта ──────────────────────────────────────────────────
    if (patient.iolResult) {
      d.iol_calc = {};
    }

  } else {
    // ── Рефракция ─────────────────────────────────────────────────────────────
    d.surgery_plan      = { laser_type: patient.laser, od: {}, os: {}, flap: { od: {}, os: {} } };
    d.nomogram_settings = {
      useCornealAstig: patient.useCorneal,
      roundTo025:      patient.doRound,
    };
    d.manifest       = { od: {}, os: {} };
    d.autoref_narrow = { od: {}, os: {} };
    d.autoref_cyclo  = { od: {}, os: {} };
    d.keratometry    = { od: {}, os: {} };
    d.pentacam       = { od: {}, os: {} };
    d.pachymetry     = { od: {}, os: {} };
    d.wtw            = { od: {}, os: {} };
    if (patient.periods && Object.keys(patient.periods).length > 0)
      d.periods = patient.periods as any;

    if (patient.domEye) {
      d.dominant_eye = { value: patient.domEye };
    }

      // Общие параметры плана
      if (d.surgery_plan) {
        if (patient.planAuthor) d.surgery_plan.author = patient.planAuthor;
        if (patient.planTweaked !== undefined) d.surgery_plan.plan_tweaked = patient.planTweaked;
      }

      (['od', 'os'] as const).forEach(side => {
        const eye = patient[side];
        if (!eye) return;
        
        // ... (rest of mapping)
        d.manifest![side] = {
          sph:  pF(eye.man_sph) ?? undefined,
          cyl:  pF(eye.man_cyl) ?? undefined,
          axis: pI(eye.man_ax)  ?? undefined,
          uva:  pF(eye.uva)     ?? undefined,
          bcva: pF(eye.bcva)    ?? undefined,
        };

        d.autoref_narrow![side] = {
          sph:    pF(eye.n_sph)  ?? undefined,
          cyl:    pF(eye.n_cyl)  ?? undefined,
          axis:   pI(eye.n_ax)   ?? undefined,
          kavg:   pF(eye.kavg)   ?? undefined,
          kercyl: pF(eye.kercyl) ?? undefined,
          kerax:  pI(eye.kerax)  ?? undefined,
        };

        d.autoref_cyclo![side] = {
          sph:  pF(eye.c_sph) ?? undefined,
          cyl:  pF(eye.c_cyl) ?? undefined,
          axis: pI(eye.c_ax)  ?? undefined,
        };

        d.keratometry![side] = {
          k1:   pF(eye.k1)   ?? undefined,
          k2:   pF(eye.k2)   ?? undefined,
          axis: pI(eye.k_ax) ?? undefined,
        };

        d.pentacam![side] = {
          ant_cyl:  pF(eye.p_ant_c)  ?? undefined,
          ant_ax:   pI(eye.p_ant_a)  ?? undefined,
          post_cyl: pF(eye.p_post_c) ?? undefined,
          post_ax:  pI(eye.p_post_a) ?? undefined,
          tot_cyl:  pF(eye.p_tot_c)  ?? undefined,
          tot_ax:   pI(eye.p_tot_a)  ?? undefined,
        };

        d.pachymetry![side] = { cct: pI(eye.cct) ?? undefined };
        d.wtw![side]        = { value: pF(eye.wtw) ?? undefined };

        // Хирургический план для глаза
        const plan = patient.savedPlan?.[side as 'od' | 'os'];
        if (plan && d.surgery_plan) {
          d.surgery_plan[side] = {
            sph:  pF(plan.sph)  ?? undefined,
            cyl:  pF(plan.cyl)  ?? undefined,
            axis: pI(plan.ax)   ?? undefined,
            optical_zone: pF(patient.oz) ?? undefined,
          };
          if (d.surgery_plan.flap) {
            d.surgery_plan.flap[side] = {
              thickness_um: pI(patient.capOrFlap) ?? undefined,
            };
          }
        }
      });
  }

  await apiPost(`/measurements/${visitId}`, payload);
}
