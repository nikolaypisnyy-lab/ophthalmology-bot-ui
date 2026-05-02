import { create } from 'zustand';
import { apiGet, setActiveClinicId } from '../api/client';
import { setAppTheme } from '../constants/design';

const LS_CLINIC      = 'rm_clinic_id';
const LS_CLINIC_NAME = 'rm_clinic_name';
const LS_PATIENTS    = 'rm_patients';
const LS_PDATA       = 'rm_pdata';

export type Language = 'en' | 'ru';
export type Theme = 'dark' | 'light';

export interface Clinic {
  clinic_id:   string;
  clinic_name: string;
  role:        string;
}

interface ClinicStore {
  clinics:         Clinic[];
  activeClinicId:  string | null;
  activeName:      string | null;
  activeLaser:     string | null;
  activeRefNomo:   number | null;
  activeRefNomoCyl: number | null;
  recommendedNomo: number | null;
  recommendedNomoCyl: number | null;
  language:        Language;
  setLanguage:     (lang: Language) => void;
  theme:           Theme;
  setTheme:        (t: Theme) => void;
  initialized?:    boolean;
  error?:          string | null;
  initClinics:     () => Promise<void>;
  switchClinic:    (id: string) => void;
  setActiveLaser:  (id: string) => void;
  setRefNomo:      (val: number | null) => void;
  setRefNomoCyl:   (val: number | null) => void;
  fetchRecommendedNomo: () => Promise<void>;
}

export const useClinicStore = create<ClinicStore>((set, get) => ({
  clinics:        [],
  activeClinicId: null,
  activeName:     null,
  activeLaser:    null,
  activeRefNomo:  null,
  activeRefNomoCyl: null,
  recommendedNomo: null,
  recommendedNomoCyl: null,
  language:       'en',
  theme:          ((): Theme => { try { return (localStorage.getItem('rm_theme') as Theme) || 'dark'; } catch { return 'dark'; } })(),
  initialized:    false,
  error:          null,

  initClinics: async () => {
    try {
      const data = await apiGet<any>('/me');
      const clinics: Clinic[] = (data.clinics ?? []).map((c: any) => ({
        clinic_id:   c.clinic_id,
        clinic_name: c.clinic_name,
        role:        c.role,
      }));

      if (clinics.length === 0) {
        set({ clinics: [], initialized: true, error: 'Вы не зарегистрированы ни в одной клинике' });
        return;
      }

      // Приоритет: ?clinic= из URL (бот передаёт при открытии WebApp) > localStorage > первая клиника
      const urlParams  = new URLSearchParams(window.location.search);
      const urlClinic  = urlParams.get('clinic');
      const cached     = urlClinic || localStorage.getItem(LS_CLINIC);
      const isValid    = clinics.some(c => c.clinic_id === cached);
      const target     = isValid ? cached! : clinics[0].clinic_id;
      const targetCl   = clinics.find(c => c.clinic_id === target)!;

      // Если клиника изменилась — сбрасываем кэш пациентов
      const prev = localStorage.getItem(LS_CLINIC);
      if (prev && prev !== target) {
        localStorage.removeItem(LS_PATIENTS);
        localStorage.removeItem(LS_PDATA);
      }

      localStorage.setItem(LS_CLINIC, target);
      localStorage.setItem(LS_CLINIC_NAME, targetCl.clinic_name);
      setActiveClinicId(target);
      
      const laser = localStorage.getItem(`rm_laser_${target}`) || 'ex500';
      const nomo  = localStorage.getItem(`rm_ref_nomo_${target}`);
      const nomoCyl = localStorage.getItem(`rm_ref_nomo_cyl_${target}`);
      const lang  = (localStorage.getItem('rm_lang') as Language) || 'en';
      set({ 
        clinics, 
        activeClinicId: target, 
        activeName: targetCl.clinic_name, 
        activeLaser: laser, 
        activeRefNomo: nomo ? parseFloat(nomo) : null,
        activeRefNomoCyl: nomoCyl ? parseFloat(nomoCyl) : null,
        language: lang,
        initialized: true, 
        error: null 
      });


      await get().fetchRecommendedNomo();

    } catch (e: any) {
      // Fallback: если API недоступен — используем сохранённую клинику и название
      const cached     = localStorage.getItem(LS_CLINIC);
      const cachedName = localStorage.getItem(LS_CLINIC_NAME);
      if (cached) {
        setActiveClinicId(cached);
        const laser = localStorage.getItem(`rm_laser_${cached}`) || 'ex500';
        set({ activeClinicId: cached, activeName: cachedName, activeLaser: laser, initialized: true, error: null });
      } else {
        set({ initialized: true, error: 'Нет соединения с сервером' });
      }
    }
  },

  switchClinic: (id) => {
    const { clinics } = get();
    const prev = localStorage.getItem(LS_CLINIC);
    if (prev !== id) {
      localStorage.setItem(LS_CLINIC, id);
      const cl = clinics.find(c => c.clinic_id === id);
      if (cl?.clinic_name) localStorage.setItem(LS_CLINIC_NAME, cl.clinic_name);
      
      localStorage.removeItem(LS_PATIENTS);
      localStorage.removeItem(LS_PDATA);
      window.location.reload(); 
    }
  },

  setActiveLaser: (id) => {
    const { activeClinicId } = get();
    if (activeClinicId) {
      localStorage.setItem(`rm_laser_${activeClinicId}`, id);
      set({ activeLaser: id });
    }
  },

  setRefNomo: (val) => {
    const { activeClinicId } = get();
    if (activeClinicId) {
      if (val === null) localStorage.removeItem(`rm_ref_nomo_${activeClinicId}`);
      else localStorage.setItem(`rm_ref_nomo_${activeClinicId}`, String(val));
      set({ activeRefNomo: val });
    }
  },
  setRefNomoCyl: (val) => {
    const { activeClinicId } = get();
    if (activeClinicId) {
      if (val === null) localStorage.removeItem(`rm_ref_nomo_cyl_${activeClinicId}`);
      else localStorage.setItem(`rm_ref_nomo_cyl_${activeClinicId}`, String(val));
      set({ activeRefNomoCyl: val });
    }
  },
  fetchRecommendedNomo: async () => {
    try {
      const data = await apiGet<any>('/nomogram');
      if (data) {
        set({ 
          recommendedNomo: data.proposed_offset_sph ?? null,
          recommendedNomoCyl: data.proposed_offset_cyl ?? null
        });
      }
    } catch (e) {}
  },
  setLanguage: (lang) => {
    localStorage.setItem('rm_lang', lang);
    set({ language: lang });
  },
  setTheme: (theme) => {
    localStorage.setItem('rm_theme', theme);
    setAppTheme(theme === 'dark');
    set({ theme });
  },
}));
