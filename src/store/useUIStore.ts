import { create } from 'zustand';
import type { TabKey } from '../types/patient';
import type { PeriodKey } from '../types/results';

type NavTab = 'patients' | 'operations' | 'results';
type EyeKey = 'od' | 'os';

interface UIStore {
  // ── Нижняя навигация ─────────────────────────────────────────────────────────
  navTab: NavTab;
  setNavTab: (tab: NavTab) => void;

  // ── Карточка пациента ────────────────────────────────────────────────────────
  openPatientId: string | null;
  patientInitialTab: TabKey;
  openPatient: (id: string, tab?: TabKey) => void;
  closePatient: () => void;

  // ── Табы внутри карточки ─────────────────────────────────────────────────────
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;

  // ── Активный глаз ────────────────────────────────────────────────────────────
  activeEye: EyeKey;          // в BioTab
  planEye: EyeKey;            // в PlanTab
  resultEye: EyeKey;          // в ResultTab
  enhancementEye: EyeKey;     // в EnhancementTab
  setActiveEye: (eye: EyeKey) => void;
  setPlanEye: (eye: EyeKey) => void;
  setResultEye: (eye: EyeKey) => void;
  setEnhancementEye: (eye: EyeKey) => void;

  // ── Период результатов ───────────────────────────────────────────────────────
  activePeriod: PeriodKey;
  setActivePeriod: (p: PeriodKey) => void;

  // ── OCR модалка ──────────────────────────────────────────────────────────────
  ocrOpen: boolean;
  ocrSection: string | null; // 'manifest' | 'narrow' | 'keratometry' | ...
  ocrOnResult: ((data: any) => void) | null;
  openOCR: (section?: string, onResult?: (data: any) => void) => void;
  closeOCR: () => void;

  // ── Выделенная секция для сканирования ───────────────────────────────────────
  targetSection: string | null;
  setTargetSection: (sec: string | null) => void;

  // ── Поиск пациентов ──────────────────────────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // ── Фильтр типа пациентов ────────────────────────────────────────────────────
  typeFilter: 'all' | 'refraction' | 'cataract';
  setTypeFilter: (f: 'all' | 'refraction' | 'cataract') => void;

  // ── Выбор линзы (открыт/закрыт) ──────────────────────────────────────────────
  lensPickerOpen: boolean;
  setLensPickerOpen: (v: boolean) => void;

  // ── Календарь виден ──────────────────────────────────────────────────────────
  calendarOpen: boolean;
  setCalendarOpen: (v: boolean) => void;

  // ── Настройки ────────────────────────────────────────────────────────────────
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  // ── Модалка нового пациента ──────────────────────────────────────────────────
  showNewPatientModal: boolean;
  openNewPatient: () => void;
  closeNewPatient: () => void;

  // ── Инлайн редактирование полей ──────────────────────────────────────────────
  editingField: string | null;
  setEditingField: (f: string | null) => void;
  tempValue: string;
  setTempValue: (v: string) => void;

  // ── Сравнение формул ИОЛ ─────────────────────────────────────────────────────
  comparisonFormulas: string[];
  toggleComparisonFormula: (f: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Навигация
  navTab: 'patients',
  setNavTab: (tab) => set({ navTab: tab }),

  // Карточка
  openPatientId: null,
  patientInitialTab: 'bio',
  openPatient: (id, tab = 'bio') => {
    if (!id || id === 'undefined' || id === '') return;
    set({ openPatientId: id, patientInitialTab: tab, activeTab: tab });
  },
  closePatient: () =>
    set({ openPatientId: null }),

  // Табы
  activeTab: 'bio',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Глаза
  activeEye: 'od',
  planEye:   'od',
  resultEye: 'od',
  enhancementEye: 'od',
  setActiveEye: (eye) => set({ activeEye: eye }),
  setPlanEye:   (eye) => set({ planEye: eye }),
  setResultEye: (eye) => set({ resultEye: eye }),
  setEnhancementEye: (eye) => set({ enhancementEye: eye }),

  // Период
  activePeriod: '1d',
  setActivePeriod: p => set({ activePeriod: p }),

  // OCR
  ocrOpen: false,
  ocrSection: null,
  ocrOnResult: null,
  openOCR: (sec, onResult) => set({ ocrOpen: true, ocrSection: sec ?? null, ocrOnResult: onResult ?? null }),
  closeOCR: () => set({ ocrOpen: false, ocrSection: null, ocrOnResult: null }),

  targetSection: null,
  setTargetSection: sec => set({ targetSection: sec }),

  // Поиск
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  // Фильтр
  typeFilter: 'all',
  setTypeFilter: (f) => set({ typeFilter: f }),

  // Lens picker
  lensPickerOpen: false,
  setLensPickerOpen: (v) => set({ lensPickerOpen: v }),

  // Календарь
  calendarOpen: false,
  setCalendarOpen: (v) => set({ calendarOpen: v }),

  // Настройки
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  // Новый пациент
  showNewPatientModal: false,
  openNewPatient: () => set({ showNewPatientModal: true }),
  closeNewPatient: () => set({ showNewPatientModal: false }),

  // Инлайн редактирование
  editingField: null,
  setEditingField: (f) => set({ editingField: f }),
  tempValue: '',
  setTempValue: (v) => set({ tempValue: v }),

  // Сравнение формул
  comparisonFormulas: [],
  toggleComparisonFormula: (f) => set(state => {
    const exists = state.comparisonFormulas.includes(f);
    if (exists) {
      return { comparisonFormulas: state.comparisonFormulas.filter(x => x !== f) };
    } else {
      // Максимум 3 для адекватного отображения на мобилке
      if (state.comparisonFormulas.length >= 2) return state; 
      return { comparisonFormulas: [...state.comparisonFormulas, f] };
    }
  }),
}));
