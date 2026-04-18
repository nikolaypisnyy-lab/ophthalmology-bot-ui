import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Patient } from '../types/patient';
// ... (keep types)
import type { TabKey } from '../types/patient';
import type { RefractionPlan } from '../types/refraction';
import type { IOLResult } from '../types/iol';
import type { PeriodKey } from '../types/results';
import type { PeriodEyeData } from '../types/results';
import { sumCylinders } from '../calculators/astigmatism';

// (rest of interface stays same)
interface SessionStore {
  draft: Patient | null;
  refPlan: { od?: RefractionPlan; os?: RefractionPlan } | null;
  enhancementPlan: { od?: RefractionPlan; os?: RefractionPlan } | null;
  planTweaked: boolean;
  iolResult: IOLResult | null;
  formulaResults: { od: Record<string, any>; os: Record<string, any> };
  iolLoading: boolean;
  iolProgress: number;

  openDraft: (patient: Patient, initialTab?: TabKey) => void;
  closeDraft: () => void;
  setDraft: (patch: Partial<Patient>) => void;
  setEyeField: (eye: 'od' | 'os', field: string, value: string) => void;
  setBioField: (eye: 'od' | 'os', field: string, value: string) => void;
  setRefPlan: (plan: { od?: RefractionPlan; os?: RefractionPlan } | null) => void;
  setEnhancementPlan: (plan: { od?: RefractionPlan; os?: RefractionPlan } | null) => void;
  setPlanTweaked: (v: boolean) => void;
  setPlanField: (eye: 'od' | 'os', field: 'sph' | 'cyl' | 'ax', value: number) => void;
  setEnhancementField: (eye: 'od' | 'os', field: 'sph' | 'cyl' | 'ax', value: number) => void;
  setIOLResult: (result: IOLResult | null) => void;
  setFormulaResults: (results: { od: Record<string, any>; os: Record<string, any> }) => void;
  setIOLLoading: (loading: boolean, progress?: number) => void;
  setPeriodEyeField: (period: PeriodKey, eye: 'od' | 'os', field: keyof PeriodEyeData, value: string) => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      draft: null,
      refPlan: null,
      enhancementPlan: null,
      planTweaked: false,
      iolResult: null,
      formulaResults: { od: {}, os: {} },
      iolLoading: false,
      iolProgress: 0,

      openDraft: (patient, _initialTab) => {
        set({
          draft: { ...patient },
          refPlan: patient.savedPlan ? { od: patient.savedPlan.od as any, os: patient.savedPlan.os as any } : null,
          enhancementPlan: (patient as any).savedEnhancement ? { od: (patient as any).savedEnhancement.od as any, os: (patient as any).savedEnhancement.os as any } : null,
          planTweaked: (patient as any).planTweaked ?? false,
          iolResult: patient.iolResult ?? null,
          formulaResults: (patient as any).formulaResults ?? { od: {}, os: {} },
          iolLoading: false,
          iolProgress: 0,
        });
      },

      closeDraft: () => {
        set({ draft: null, refPlan: null, enhancementPlan: null, planTweaked: false, iolResult: null, formulaResults: { od: {}, os: {} } });
      },

      setDraft: (patch) => {
        set(state => state.draft ? { draft: { ...state.draft, ...patch } } : state);
      },

      setEyeField: (eye, field, value) => {
        set(state => {
          if (!state.draft) return state;
          const eyeData = { ...(state.draft[eye] ?? {}) } as any;
          eyeData[field] = value;
          if (field === 'k1' || field === 'k2') {
            const k1 = parseFloat(eyeData.k1 || '0');
            const k2 = parseFloat(eyeData.k2 || '0');
            if (k1 > 0 && k2 > 0) eyeData.kavg = ((k1 + k2) / 2).toFixed(2);
          }
          const pFields = ['p_ant_c', 'p_ant_a', 'p_post_c', 'p_post_a'];
          if (pFields.includes(field)) {
            const c1 = parseFloat(eyeData.p_ant_c || '0'), a1 = parseFloat(eyeData.p_ant_a || '0'), c2 = parseFloat(eyeData.p_post_c || '0'), a2 = parseFloat(eyeData.p_post_a || '0');
            if (c1 !== 0 || c2 !== 0) {
              // Задняя поверхность роговицы (c2) работает как компенсация (отрицательная линза),
              // поэтому для корректного векторного сложения (Ant - Post) передаем её с минусом.
              const res = sumCylinders(c1, a1, -c2, a2);
              eyeData.p_tot_c = Math.abs(res.cyl).toFixed(2);
              eyeData.p_tot_a = String(res.ax);
            }
          }
          return { draft: { ...state.draft, [eye]: eyeData } };
        });
      },

      setBioField: (eye, field, value) => {
        const bioKey = `bio_${eye}` as 'bio_od' | 'bio_os';
        set(state => {
          if (!state.draft) return state;
          const bioData = state.draft[bioKey] ?? {};
          return { draft: { ...state.draft, [bioKey]: { ...bioData, [field]: value } } };
        });
      },

      setRefPlan: (plan) => set({ refPlan: plan }),
      setEnhancementPlan: (plan) => set({ enhancementPlan: plan }),
      setPlanTweaked: (v) => set(state => ({
        planTweaked: v,
        draft: state.draft ? { ...state.draft, planTweaked: v } as any : state.draft
      })),

      setPlanField: (eye, field, value) => {
        set(state => {
          const plan = state.refPlan ?? {};
          const eyePlan = plan[eye] ?? ({} as any);
          const updated = { ...plan, [eye]: { ...eyePlan, [field]: value } };
          return {
            refPlan: updated,
            planTweaked: true,
            draft: state.draft ? { 
              ...state.draft, 
              planTweaked: true,
              savedPlan: { ...(state.draft.savedPlan ?? {}), [eye]: { ...eyePlan, [field]: value } } 
            } as any : state.draft,
          };
        });
      },

      setEnhancementField: (eye, field, value) => {
        set(state => {
          const plan = state.enhancementPlan ?? {};
          const eyePlan = plan[eye] ?? ({} as any);
          const updated = { ...plan, [eye]: { ...eyePlan, [field]: value } };
          return {
            enhancementPlan: updated,
            planTweaked: true,
            draft: state.draft ? { 
              ...state.draft, 
              planTweaked: true,
              savedEnhancement: { ...((state.draft as any).savedEnhancement ?? {}), [eye]: { ...eyePlan, [field]: value } } 
            } as any : state.draft as any,
          };
        });
      },

      setIOLResult: (result) => {
        set(state => ({
          iolResult: result,
          draft: state.draft && result ? { ...state.draft, iolResult: result } : state.draft,
        }));
      },

      setFormulaResults: (results) => {
        set(state => ({
          formulaResults: results,
          draft: state.draft ? { ...state.draft, formulaResults: results } as any : state.draft
        }));
      },

      setIOLLoading: (loading, progress = 0) => { set({ iolLoading: loading, iolProgress: progress }); },

      setPeriodEyeField: (period, eye, field, value) => {
        set(state => {
          if (!state.draft) return state;
          const periods = (state.draft.periods ?? {}) as any;
          const periodData = (periods[period] ?? {}) as any;
          const eyeData = (periodData[eye] ?? {}) as any;
          return { draft: { ...state.draft, periods: { ...periods, [period]: { ...periodData, [eye]: { ...eyeData, [field]: value } } } } };
        });
      },
    }),
    {
      name: 'refmaster-session-storage',
    }
  )
);
