import { create } from 'zustand';
import { apiGet, setActiveClinicId } from '../api/client';

const LS_CLINIC      = 'rm_clinic_id';
const LS_CLINIC_NAME = 'rm_clinic_name';
const LS_PATIENTS    = 'rm_patients';
const LS_PDATA       = 'rm_pdata';

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
  initialized:     boolean;
  error:           string | null;
  initClinics:     () => Promise<void>;
  switchClinic:    (id: string) => void;
  setActiveLaser:  (id: string) => void;
}

export const useClinicStore = create<ClinicStore>((set, get) => ({
  clinics:        [],
  activeClinicId: null,
  activeName:     null,
  activeLaser:    null,
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
      set({ clinics, activeClinicId: target, activeName: targetCl.clinic_name, activeLaser: laser, initialized: true, error: null });

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
      localStorage.removeItem(LS_PATIENTS);
      localStorage.removeItem(LS_PDATA);
    }
    localStorage.setItem(LS_CLINIC, id);
    setActiveClinicId(id);
    const cl = clinics.find(c => c.clinic_id === id);
    if (cl?.clinic_name) localStorage.setItem(LS_CLINIC_NAME, cl.clinic_name);
    
    const laser = localStorage.getItem(`rm_laser_${id}`) || 'ex500';
    set({ activeClinicId: id, activeName: cl?.clinic_name ?? null, activeLaser: laser });
  },

  setActiveLaser: (id) => {
    const { activeClinicId } = get();
    if (activeClinicId) {
      localStorage.setItem(`rm_laser_${activeClinicId}`, id);
      set({ activeLaser: id });
    }
  },
}));
