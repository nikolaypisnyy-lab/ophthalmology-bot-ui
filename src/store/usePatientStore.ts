import { create } from 'zustand';
import type { PatientSummary, Patient } from '../types/patient';
import type { TabKey } from '../types/patient';
import {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient as apiDeletePatient,
  savePatientMeta,
} from '../api/patients';
import {
  getMeasurements,
  saveMeasurements,
  mapEyeData,
  mapBiometryData,
  mapFormulaResults,
} from '../api/measurements';
import { newEyeData } from '../types/refraction';
import { newBiometryData } from '../types/iol';

// ── Локальный кэш (localStorage) ─────────────────────────────────────────────

const LS_PATIENTS = 'rm_patients';
const LS_PDATA = 'rm_pdata';

// Одноразовая очистка невалидных записей при загрузке модуля
try {
  const raw = localStorage.getItem(LS_PATIENTS);
  if (raw) {
    const list = JSON.parse(raw);
    const clean = list.filter((p: any) => p.id && String(p.id) !== 'undefined' && String(p.id) !== '');
    if (clean.length !== list.length) localStorage.setItem(LS_PATIENTS, JSON.stringify(clean));
  }
} catch { }

function lsGetPatients(): PatientSummary[] {
  try {
    const list: PatientSummary[] = JSON.parse(localStorage.getItem(LS_PATIENTS) ?? '[]');
    return list.filter(p => p.id && String(p.id) !== 'undefined' && String(p.id) !== '');
  }
  catch { return []; }
}
function lsSavePatients(list: PatientSummary[]) {
  localStorage.setItem(LS_PATIENTS, JSON.stringify(list));
}
function lsGetPData(): Record<string, Patient> {
  try { return JSON.parse(localStorage.getItem(LS_PDATA) ?? '{}'); }
  catch { return {}; }
}
function lsSavePData(map: Record<string, Patient>) {
  localStorage.setItem(LS_PDATA, JSON.stringify(map));
}

// ── Типы стора ────────────────────────────────────────────────────────────────

interface PatientStore {
  // Список
  patients: PatientSummary[];
  loading: boolean;
  error: string | null;

  // Кэш полных данных { [id]: Patient }
  fullData: Record<string, Patient>;

  // Методы
  fetchPatients: () => Promise<void>;
  fetchPatientFull: (id: string, initialTab?: TabKey) => Promise<Patient | null>;
  savePatient: (patient: Patient) => Promise<Patient>;
  deletePatient: (id: string) => Promise<void>;
  patchLocal: (id: string, patch: Partial<Patient>) => void;
  reorderPatients: (id: string, newOrder: number) => Promise<void>;
}

// ── Стор ─────────────────────────────────────────────────────────────────────

export const usePatientStore = create<PatientStore>((set, get) => ({
  patients: lsGetPatients().filter(p => p.id && String(p.id) !== 'undefined'),
  loading: false,
  error: null,
  fullData: lsGetPData(),

  reorderPatients: async (id, newOrder) => {
    // 1. Обновляем локально
    set(state => {
      const plist = [...state.patients];
      const idx = plist.findIndex(p => String(p.id) === String(id));
      if (idx !== -1) {
        plist[idx] = { ...plist[idx], surgicalOrder: newOrder };
      }
      lsSavePatients(plist);

      const fd = { ...state.fullData };
      if (fd[id]) {
        fd[id] = { ...fd[id], surgicalOrder: newOrder };
        lsSavePData(fd);
      }
      return { patients: plist, fullData: fd };
    });

    // 2. Сервер
    try {
      await updatePatient(id, { surgical_order: newOrder });
    } catch (e: any) {
      console.warn('reorderPatients API error:', e.message);
    }
  },

  // ── Загрузить список ────────────────────────────────────────────────────────
  fetchPatients: async () => {
    set({ loading: true, error: null });

    // Хелпер: извлечь лучший результат глаза из periods (кэш fullData)
    const periodOrder = ['1y', '6m', '3m', '1m', '1w', '1d'];
    const computeEyeFromPeriods = (fd: Patient | undefined, eye: 'od' | 'os') => {
      if (!fd?.periods) return null;
      for (const pk of periodOrder) {
        const ed = (fd.periods as any)[pk]?.[eye];
        if (ed?.sph !== undefined && String(ed.sph) !== '') {
          return {
            sph: parseFloat(String(ed.sph)),
            cyl: parseFloat(String(ed.cyl ?? '0')) || 0,
            ax:  parseInt(String(ed.ax ?? '0'))  || 0,
            va:  String(ed.va ?? ''),
          };
        }
      }
      return null;
    };

    try {
      const resp = await getPatients();
      // Убираем дубли по ID
      const unique = Array.from(new Map(resp.map(p => [String(p.id), p])).values());

      // Сервер не хранит status/postSph — берём их из локального кэша
      const existingMap = new Map(lsGetPatients().map(p => [String(p.id), p]));
      // fullData кэш — для вычисления postVaOD/postVaOS из periods (если не сохранены в summary)
      const fullDataCache = lsGetPData();

      const merged = unique.map(p => {
        const ex  = existingMap.get(String(p.id));
        const fd  = fullDataCache[String(p.id)];
        const compOD = computeEyeFromPeriods(fd, 'od');
        const compOS = computeEyeFromPeriods(fd, 'os');
        const anyComp = compOD ?? compOS;
        return {
          ...p,
          status:    ex?.status    ?? (anyComp ? 'done' : undefined) ?? p.status,
          postSph:   ex?.postSph   ?? anyComp?.sph  ?? p.postSph,
          postCyl:   ex?.postCyl   ?? anyComp?.cyl  ?? p.postCyl,
          postSphOD: ex?.postSphOD ?? compOD?.sph   ?? p.postSphOD,
          postCylOD: ex?.postCylOD ?? compOD?.cyl   ?? p.postCylOD,
          postAxOD:  ex?.postAxOD  ?? compOD?.ax    ?? p.postAxOD,
          postVaOD:  ex?.postVaOD  ?? compOD?.va    ?? p.postVaOD,
          postSphOS: ex?.postSphOS ?? compOS?.sph   ?? p.postSphOS,
          postCylOS: ex?.postCylOS ?? compOS?.cyl   ?? p.postCylOS,
          postAxOS:  ex?.postAxOS  ?? compOS?.ax    ?? p.postAxOS,
          postVaOS:  ex?.postVaOS  ?? compOS?.va    ?? p.postVaOS,
          iolResult: ex?.iolResult ?? fd?.iolResult ?? p.iolResult,
          periods:   ex?.periods   ?? fd?.periods   ?? p.periods,
          surgicalOrder: ex?.surgicalOrder ?? p.surgicalOrder,
          flapDiam:  ex?.flapDiam  ?? p.flapDiam,
          capOrFlap: ex?.capOrFlap ?? p.capOrFlap,
          isCustomViewOD: ex?.isCustomViewOD ?? p.isCustomViewOD,
          isCustomViewOS: ex?.isCustomViewOS ?? p.isCustomViewOS,
          astigStrategyOD: ex?.astigStrategyOD ?? fd?.od?.astigStrategy ?? p.astigStrategyOD,
          astigStrategyOS: ex?.astigStrategyOS ?? fd?.os?.astigStrategy ?? p.astigStrategyOS,
          toricResults: (ex as any)?.toricResults ?? (fd as any)?.toricResults ?? (p as any)?.toricResults,
          savedPlan: ex?.savedPlan ?? fd?.savedPlan ?? p.savedPlan,
        };
      });

      lsSavePatients(merged);
      set({ patients: merged, loading: false });
    } catch (e: any) {
      // Fallback на localStorage — фильтруем пациентов без ID
      const cached = lsGetPatients().filter(p => p.id && String(p.id) !== 'undefined');
      set({ patients: cached, loading: false, error: e.message });
    }
  },

  // ── Загрузить полные данные пациента ────────────────────────────────────────
  fetchPatientFull: async (id, _initialTab) => {
    if (!id || id === 'undefined') return null;

    // Сначала отдаём кэш
    const cached = lsGetPData()[String(id)] ?? null;

    try {
      const detail = await getPatient(String(id));
      if (!detail.patient) return cached;

      const visitId = detail.visit?.visit_id
        ? String(detail.visit.visit_id)
        : null;

      // Базовые поля пациента
      const p = detail.patient;
      const loaded: Patient = {
        ...(cached ?? {}),
        id: String(p.patient_id || id), // fallback на id если вдруг patient_id нет
        name: p.name,
        age: String(p.age ?? ''),
        sex: (p.sex as any) ?? cached?.sex,
        type: (p.patient_type as any) ?? cached?.type ?? 'refraction',
        eye: (p.op_eye as any) ?? cached?.eye ?? 'OU',
        date: p.op_date ?? cached?.date,
        _visitId: visitId,
        od: p.od ?? cached?.od,
        os: p.os ?? cached?.os,
        isCustomViewOD: p.isCustomViewOD ?? cached?.isCustomViewOD,
        isCustomViewOS: p.isCustomViewOS ?? cached?.isCustomViewOS,
      } as Patient & { _visitId?: string };

      // Загружаем измерения если есть visitId
      if (visitId) {
        const mRes = await getMeasurements(visitId);
        const m = mRes.data;
        if (m) {
          if (loaded.type === 'cataract') {
            loaded.bio_od = { ...newBiometryData(), ...mapBiometryData(m, 'od') };
            loaded.bio_os = { ...newBiometryData(), ...mapBiometryData(m, 'os') };

            // Загружаем результаты расчётов
            const fr = mapFormulaResults(m);
            (loaded as any).formulaResults = { od: fr.od, os: fr.os };
            if (fr.active) loaded.activeFormula = fr.active as 'Haigis' | 'Barrett' | 'Kane';

            // Загружаем выбранную линзу
            if (m.iol_calc?.selected_iol) {
              const { od, os } = m.iol_calc.selected_iol as any;
              const anyEye = od || os;
              if (anyEye) {
                (loaded as any).iolResult = {
                  lens: anyEye.model || '',
                  od: od ? { selectedPower: od.power, expectedRefr: od.expected_refr } : undefined,
                  os: os ? { selectedPower: os.power, expectedRefr: os.expected_refr } : undefined,
                  power: (anyEye.power > 0 ? '+' : '') + anyEye.power.toFixed(2),
                };
              }
            }
          } else {
            // Рефракция — МЕРДЖИМ данные из анкеты и данные из измерений
            loaded.od = { ...newEyeData(), ...loaded.od, ...mapEyeData(m, 'od') };
            loaded.os = { ...newEyeData(), ...loaded.os, ...mapEyeData(m, 'os') };

            // Настройки лазера
            loaded.laser = (m.surgery_plan?.laser_type as any) ?? loaded.laser ?? 'ex500';
            loaded.useCorneal = m.nomogram_settings?.useCornealAstig ?? loaded.useCorneal ?? true;
            loaded.doRound = m.nomogram_settings?.roundTo025 ?? loaded.doRound ?? true;
            loaded.planAuthor = (m.surgery_plan?.author as any) ?? loaded.planAuthor;
            (loaded as any).planTweaked = m.surgery_plan?.plan_tweaked ?? false;

            // Сохранённый план
            const plan: Patient['savedPlan'] = {};
            (['od', 'os'] as const).forEach(side => {
              const sp = m.surgery_plan?.[side];
              if (sp) {
                plan[side] = { sph: sp.sph ?? 0, cyl: sp.cyl ?? 0, ax: sp.axis ?? 0 } as any;
              }
            });
            if (Object.keys(plan).length) loaded.savedPlan = plan;

          }

          // Постоп периоды — для всех типов пациентов;
          // берём с сервера только если там есть реальные данные,
          // иначе сохраняем то что уже есть в кэше (не затираем локальные данные)
          const serverPeriods = m.periods;
          if (serverPeriods && Object.keys(serverPeriods).length > 0) {
            loaded.periods = serverPeriods as any;
          }
        }
      }

      // Вычисляем per-eye summary из periods (ретроактивно для старых пациентов)
      if (loaded.periods) {
        const pOrder = ['1y', '6m', '3m', '1m', '1w', '1d'];
        const findEye = (eye: 'od' | 'os') => {
          for (const pk of pOrder) {
            const ed = (loaded.periods as any)[pk]?.[eye];
            if (ed?.sph !== undefined && String(ed.sph) !== '') {
              return { 
                sph: parseFloat(String(ed.sph)), 
                cyl: parseFloat(String(ed.cyl ?? '0')) || 0, 
                ax:  parseInt(String(ed.ax ?? '0')) || 0, 
                va:  String(ed.va ?? '') 
              };
            }
          }
          return null;
        };
        const odR = findEye('od');
        const osR = findEye('os');
        const anyR = odR ?? osR;
        if (anyR) {
          loaded.status  = 'done';
          loaded.postSph = anyR.sph;
          loaded.postCyl = anyR.cyl;
        }
        if (odR) { 
          (loaded as any).postSphOD = odR.sph; 
          (loaded as any).postCylOD = odR.cyl; 
          (loaded as any).postAxOD = odR.ax;
          (loaded as any).postVaOD = odR.va; 
        }
        if (osR) { 
          (loaded as any).postSphOS = osR.sph; 
          (loaded as any).postCylOS = osR.cyl; 
          (loaded as any).postAxOS = osR.ax;
          (loaded as any).postVaOS = osR.va; 
        }
      }

      // Сохраняем в кэш
      const map = lsGetPData();
      map[id] = loaded;
      lsSavePData(map);
      set(state => {
        const fd = { ...state.fullData, [id]: loaded };
        // Обновляем summary в patients[] — чтобы ResultsPage сразу видел VA
        const plist = state.patients.map(p => String(p.id) === String(id) ? {
          ...p,
          status:    (loaded as any).status    ?? p.status,
          postSph:   (loaded as any).postSph   ?? p.postSph,
          postCyl:   (loaded as any).postCyl   ?? p.postCyl,
          postSphOD: (loaded as any).postSphOD ?? p.postSphOD,
          postCylOD: (loaded as any).postCylOD ?? p.postCylOD,
          postAxOD:  (loaded as any).postAxOD  ?? p.postAxOD,
          postVaOD:  (loaded as any).postVaOD  ?? p.postVaOD,
          postSphOS: (loaded as any).postSphOS ?? p.postSphOS,
          postCylOS: (loaded as any).postCylOS ?? p.postCylOS,
          postAxOS:  (loaded as any).postAxOS  ?? p.postAxOS,
          postVaOS:  (loaded as any).postVaOS  ?? p.postVaOS,
          flapDiam:  (loaded as any).flapDiam  ?? p.flapDiam,
          capOrFlap: (loaded as any).capOrFlap ?? p.capOrFlap,
          isCustomViewOD: (loaded as any).isCustomViewOD ?? p.isCustomViewOD,
          isCustomViewOS: (loaded as any).isCustomViewOS ?? p.isCustomViewOS,
        } : p);
        lsSavePatients(plist);
        return { fullData: fd, patients: plist };
      });

      return loaded;
    } catch (e: any) {
      console.warn('fetchPatientFull error:', e.message);
      return cached;
    }
  },

  // ── Сохранить пациента ──────────────────────────────────────────────────────
  savePatient: async (patient) => {
    // 1. Сохраняем в localStorage немедленно
    const localId = patient.id || ('local_' + Date.now());
    const withId: Patient = { ...patient, id: localId };

    const pmap = lsGetPData();
    pmap[localId] = withId;
    lsSavePData(pmap);

    const summary: PatientSummary = {
      id: localId,
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      type: patient.type,
      eye: patient.eye,
      date: patient.date,
      status: patient.status ?? 'planned',
      postSph: patient.postSph,
      postCyl: patient.postCyl,
      postSphOD: (patient as any).postSphOD,
      postCylOD: (patient as any).postCylOD,
      postAxOD:  (patient as any).postAxOD,
      postVaOD:  (patient as any).postVaOD,
      postSphOS: (patient as any).postSphOS,
      postCylOS: (patient as any).postCylOS,
      postAxOS:  (patient as any).postAxOS,
      postVaOS:  (patient as any).postVaOS,
      targetRefr: patient.targetRefr,
      isEnhancement: patient.isEnhancement,
      flapDiam: (patient as any).flapDiam,
      capOrFlap: (patient as any).capOrFlap,
      isCustomViewOD: patient.isCustomViewOD,
      isCustomViewOS: patient.isCustomViewOS,
      astigStrategyOD: patient.od?.astigStrategy,
      astigStrategyOS: patient.os?.astigStrategy,
      // Сохраняем iolResult и savedPlan в summary
      iolResult: patient.iolResult,
      savedPlan: patient.savedPlan,
    } as PatientSummary;

    const plist = lsGetPatients();
    const idx = plist.findIndex(x => String(x.id) === String(localId));
    if (idx >= 0) plist[idx] = summary;
    else plist.unshift(summary);
    lsSavePatients(plist);

    set(state => ({
      patients: [...plist],
      fullData: { ...state.fullData, [localId]: withId },
    }));

    // 2. Синхронизируем с API
    try {
      const { patientId, visitId: newVisitId } = await savePatientMeta(patient);
      const visitId = (patient as any)._visitId ?? newVisitId;

      // Сохраняем измерения
      if (visitId) {
        await saveMeasurements(visitId, { ...patient, id: patientId });
      }

      // Обновляем список с сервера (это затрет локальную копию с local_... в patients[])
      await get().fetchPatients();

      // Чистим кэш fullData от временного ID и ставим постоянный
      if (patientId && String(patientId) !== String(localId)) {
        const m2 = lsGetPData();
        m2[patientId] = { ...withId, id: patientId };
        if (localId.startsWith('local_')) {
          delete m2[localId];
        }
        lsSavePData(m2);

        set(state => {
          const fd = { ...state.fullData };
          fd[patientId] = { ...withId, id: patientId };
          if (localId.startsWith('local_')) {
            delete fd[localId];
          }
          return { fullData: fd };
        });
      }

      return { ...withId, id: patientId };
    } catch (e: any) {
      console.warn('savePatient API error:', e.message);
      return withId;
    }
  },

  // ── Удалить пациента ────────────────────────────────────────────────────────
  deletePatient: async (id) => {
    // Удаляем из localStorage сразу
    const pmap = lsGetPData();
    delete pmap[id];
    lsSavePData(pmap);

    const plist = lsGetPatients().filter(p => String(p.id) !== String(id));
    lsSavePatients(plist);

    set(state => {
      const fd = { ...state.fullData };
      delete fd[id];
      return { patients: plist, fullData: fd };
    });

    // Удаляем на сервере
    try {
      await apiDeletePatient(id);
    } catch (e: any) {
      console.warn('deletePatient API error:', e.message);
    }
  },

  // ── Обновить поле пациента локально (без сохранения) ───────────────────────
  patchLocal: (id, patch) => {
    set(state => {
      const existing = state.fullData[id];
      if (!existing) return state;
      const updated = { ...existing, ...patch };
      const fd = { ...state.fullData, [id]: updated };
      // Синхронизируем в localStorage
      const pmap = lsGetPData();
      pmap[id] = updated;
      lsSavePData(pmap);
      return { fullData: fd };
    });
  },
}));
