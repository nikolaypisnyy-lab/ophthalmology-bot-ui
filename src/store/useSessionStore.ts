import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Patient } from '../types/patient';
import type { TabKey } from '../types/patient';
import type { RefractionPlan } from '../types/refraction';
import type { IOLResult } from '../types/iol';
import type { PeriodKey } from '../types/results';
import type { PeriodEyeData } from '../types/results';
import { sumCylinders } from '../calculators/astigmatism';

interface SessionStore {
  draft: Patient | null;
  refPlan: { od?: RefractionPlan; os?: RefractionPlan } | null;
  enhancementPlan: { od?: RefractionPlan; os?: RefractionPlan } | null;
  planTweaked: boolean;
  iolResult: IOLResult | null;
  formulaResults: { od: Record<string, any>; os: Record<string, any> };
  iolLoading: boolean;
  iolError: string | null;
  iolProgress: number;
  toricResults: { od: any; os: any };
  isRounding: boolean;
  toggleRounding: () => void;

  openDraft: (patient: Patient, initialTab?: TabKey) => void;
  closeDraft: () => void;
  setDraft: (patch: Partial<Patient>) => void;
  toggleSurgicalEye: (eye: 'od' | 'os') => void;
  setEyeField: (eye: 'od' | 'os', field: string, value: string) => void;
  setBioField: (eye: 'od' | 'os', field: string, value: string) => void;
  setRefPlan: (plan: { od?: RefractionPlan; os?: RefractionPlan } | null) => void;
  setEnhancementPlan: (plan: { od?: RefractionPlan; os?: RefractionPlan } | null) => void;
  setPlanTweaked: (v: boolean) => void;
  setPlanField: (eye: 'od' | 'os', field: 'sph' | 'cyl' | 'ax' | 'oz' | 'flap' | 'abl', value: number) => void;
  autoSetPlan: (eye: 'od' | 'os', patch: Partial<RefractionPlan>) => void;
  setEnhancementField: (eye: 'od' | 'os', field: 'sph' | 'cyl' | 'ax', value: number) => void;
  setIOLResult: (result: IOLResult | null) => void;
  setFormulaResults: (results: { od: Record<string, any>; os: Record<string, any> }) => void;
  setIOLLoading: (loading: boolean, progress?: number) => void;
  setIOLError: (error: string | null) => void;
  setToricResults: (results: { od: any; os: any }) => void;
  setPeriodEyeField: (period: PeriodKey, eye: 'od' | 'os', field: keyof PeriodEyeData, value: string) => void;
  setPeriodOUField: (period: PeriodKey, field: 'ou_va' | 'note', value: string) => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, _get) => ({
      draft: null,
      refPlan: null,
      enhancementPlan: null,
      planTweaked: false,
      iolResult: null,
      formulaResults: { od: {}, os: {} },
      iolLoading: false,
      iolError: null,
      iolProgress: 0,
      toricResults: { od: null, os: null },
      isRounding: true,
      toggleRounding: () => set(state => {
        const next = !state.isRounding;
        if (next && state.refPlan) {
          const updated = { ...state.refPlan };
          ['od', 'os'].forEach((eye: any) => {
            if (updated[eye as 'od' | 'os']) {
              const p = updated[eye as 'od' | 'os']!;
              updated[eye as 'od' | 'os'] = {
                ...p,
                sph: Math.round(p.sph * 4) / 4,
                cyl: Math.round(p.cyl * 4) / 4
              };
            }
          });
          return { isRounding: next, refPlan: updated };
        }
        return { isRounding: next };
      }),

      openDraft: (patient, _initialTab) => {
        set({
          draft: { ...patient, flapTech: patient.flapTech ?? 'fs' },
          refPlan: patient.savedPlan ? { od: patient.savedPlan.od as any, os: patient.savedPlan.os as any } : null,
          enhancementPlan: (patient as any).savedEnhancement ? { od: (patient as any).savedEnhancement.od as any, os: (patient as any).savedEnhancement.os as any } : null,
          planTweaked: (patient as any).planTweaked ?? false,
          iolResult: patient.iolResult ?? null,
          formulaResults: (patient as any).formulaResults ?? { od: {}, os: {} },
          iolLoading: false,
          iolError: null,
          iolProgress: 0,
        });
      },

      closeDraft: () => {
        set({ draft: null, refPlan: null, enhancementPlan: null, planTweaked: false, iolResult: null, formulaResults: { od: {}, os: {} }, iolError: null });
      },

      setDraft: (patch) => {
        set(state => state.draft ? { draft: { ...state.draft, ...patch } } : state);
      },

      toggleSurgicalEye: (eye) => {
        set(state => {
          if (!state.draft) return state;
          const current = (state.draft.eye || 'OU').toUpperCase();
          let next = 'OU';
          if (eye === 'od') {
            if (current === 'OU') next = 'OS';
            else if (current === 'OS') next = 'OU';
            else return state;
          } else {
            if (current === 'OU') next = 'OD';
            else if (current === 'OD') next = 'OU';
            else return state;
          }
          return { draft: { ...state.draft, eye: next as any } };
        });
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

          if (field === 'k1_ax' || field === 'k2_ax' || field === 'kerax') {
            const v = parseFloat(value);
            if (!isNaN(v)) {
              let opposite = v + 90;
              if (opposite >= 180) opposite -= 180;
              const target = (field === 'k1_ax' || field === 'kerax') ? 'k2_ax' : 'k1_ax';
              eyeData[target] = opposite.toString();
              // If field was kerax, also set k1_ax for consistency in biometry
              if (field === 'kerax') eyeData.k1_ax = value;
              if (target === 'k1_ax' && field === 'k2_ax') eyeData.kerax = opposite.toString();
              if (field === 'k1_ax') eyeData.kerax = value;
            }
          }
          
          return { draft: { ...state.draft, [eye]: eyeData } };
        });
      },

      setBioField: (eye, field, value) => {
        const bioKey = `bio_${eye}` as 'bio_od' | 'bio_os';
        set(state => {
          if (!state.draft) return state;
          const bioData = { ...(state.draft[bioKey] ?? {}) } as any;
          bioData[field] = value;
          if (field === 'k1_ax' || field === 'k2_ax') {
            const v = parseFloat(value);
            if (!isNaN(v)) {
              let opposite = v + 90;
              if (opposite >= 180) opposite -= 180;
              const target = field === 'k1_ax' ? 'k2_ax' : 'k1_ax';
              bioData[target] = opposite.toString();
            }
          }
          return { draft: { ...state.draft, [bioKey]: bioData } };
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
              savedPlan: updated
            } as any : state.draft,
          };
        });
      },

      autoSetPlan: (eye, patch) => {
        set(state => {
          const plan = state.refPlan ?? {};
          const eyePlan = plan[eye] ?? ({} as any);
          const updated = { ...plan, [eye]: { ...eyePlan, ...patch } };
          return {
            refPlan: updated,
            draft: state.draft ? { ...state.draft, savedPlan: updated } as any : state.draft,
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
          formulaResults: { ...results }, // ГАРАНТИРУЕМ НОВУЮ ССЫЛКУ
          draft: state.draft ? { ...state.draft, formulaResults: { ...results } } as any : state.draft
        }));
      },

      setIOLLoading: (loading, progress = 0) => set({ iolLoading: loading, iolProgress: progress }),
      setIOLError: (error) => set({ iolError: error }),
      setToricResults: (results) => set({ toricResults: results }),

      setPeriodEyeField: (period, eye, field, value) => {
        set(state => {
          if (!state.draft) return state;
          const periods = (state.draft.periods ?? {}) as any;
          const periodData = (periods[period] ?? {}) as any;
          const eyeData = (periodData[eye] ?? {}) as any;
          return { draft: { ...state.draft, periods: { ...periods, [period]: { ...periodData, [eye]: { ...eyeData, [field]: value } } } } };
        });
      },

      setPeriodOUField: (period, field, value) => {
        set(state => {
          if (!state.draft) return state;
          const periods = (state.draft.periods ?? {}) as any;
          const periodData = (periods[period] ?? {}) as any;
          return { draft: { ...state.draft, periods: { ...periods, [period]: { ...periodData, [field]: value } } } };
        });
      },
    }),
    {
      name: 'refmaster-session-storage',
    }
  )
);
