import React, { useEffect, useState } from 'react';
import { C, F } from './constants/design';
import { useUIStore } from './store/useUIStore';
import { usePatientStore } from './store/usePatientStore';
import { useSessionStore } from './store/useSessionStore';
import { useTelegram } from './hooks/useTelegram';
import { PatientsPage } from './pages/PatientsPage';
import { OperationsPage } from './pages/OperationsPage';
import { ResultsPage } from './pages/ResultsPage';
import { PatientCard } from './features/patient-card/PatientCard';
import { OCRModal } from './features/ocr/OCRModal';
import { SettingsModal } from './features/settings/SettingsModal';
import { useClinicStore } from './store/useClinicStore';

// При ошибке хуков (HMR mismatch) — авто-перезагрузка страницы (один раз)
class HooksErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };

  componentDidCatch(error: Error) {
    if (error.message.includes('hooks') || error.message.includes('Hooks')) {
      if (!sessionStorage.getItem('_hreload')) {
        sessionStorage.setItem('_hreload', '1');
        window.location.reload();
        return;
      }
    }
    sessionStorage.removeItem('_hreload');
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}

// ── Глобальные стили ──────────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { height: 100%; }
      body { background: ${C.bg}; color: ${C.text}; font-family: ${F.sans}; -webkit-font-smoothing: antialiased; }
      input, textarea, select { font-family: ${F.sans}; }
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      input[type=number] { -moz-appearance: textfield; }
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(100%); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .su { animation: slideUp .28s cubic-bezier(.16,1,.3,1) both; }
      .si { animation: slideIn .32s cubic-bezier(.16,1,.3,1) both; }
      .fi { animation: fadeIn .2s ease both; }
    `}</style>
  );
}

// ── Навигация ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    key: 'patients' as const,
    label: 'Пациенты',
    icon: (
      <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    key: 'operations' as const,
    label: 'Операции',
    icon: (
      <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    key: 'results' as const,
    label: 'Результаты',
    icon: (
      <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

function AppHeader({ title }: { title: string }) {
  const { openSettings } = useUIStore();
  return (
    <div style={{
      background: 'linear-gradient(160deg,#0d0c1a 0%,#141230 100%)',
      padding: 'max(18px, env(safe-area-inset-top, 0px)) 20px 14px',
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 500, color: C.muted, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            RefMaster v2.57
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 700, color: C.text, marginTop: 2 }}>
            {title}
          </div>
        </div>
        <div 
          onClick={openSettings}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: `linear-gradient(135deg,${C.accent},#5b4fd4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${C.accentGlow}`,
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function BottomNav() {
  const { navTab, setNavTab } = useUIStore();
  return (
    <div style={{
      display: 'flex', background: C.nav,
      borderTop: `1px solid ${C.border}`,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      flexShrink: 0,
    }}>
      {NAV_ITEMS.map(item => {
        const active = navTab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => setNavTab(item.key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '10px 0 12px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: active ? C.accent : C.muted,
              transition: 'color .15s',
            }}
          >
            {item.icon}
            <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: active ? 600 : 400 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Скелетон загрузки ─────────────────────────────────────────────────────────

function CardSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        background: 'linear-gradient(135deg,#0d0c1a 0%,#16143a 100%)',
        padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px 12px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            style={{
              background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: '7px 12px',
              cursor: 'pointer', color: C.muted2,
              fontFamily: F.sans, fontSize: 13, flexShrink: 0,
            }}
          >
            ← Назад
          </button>
          <div style={{ flex: 1, height: 18, background: C.surface2, borderRadius: 6, opacity: 0.5 }} />
        </div>
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `3px solid ${C.surface2}`,
          borderTopColor: C.accent,
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontFamily: F.sans, fontSize: 13, color: C.muted }}>
          Загрузка...
        </span>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

console.log("RefMaster Build:", Date.now());

export function App() {
  const { navTab, openPatientId, closePatient, setActiveEye, openSettings } = useUIStore();
  const { fetchPatients, fetchPatientFull, patients, fullData } = usePatientStore();
  const { openDraft, closeDraft, draft } = useSessionStore();
  const { initClinics, initialized, error: clinicError } = useClinicStore();
  const [cardLoading, setCardLoading] = useState(false);

  const { tg, haptic } = useTelegram();

  // Глобальные свайп-жесты
  useEffect(() => {
    let startY = 0;
    let startX = 0;

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;

      // Свайп вниз ≥ половины экрана → закрыть WebApp
      if (dy >= window.innerHeight * 0.5 && Math.abs(dx) < 60) {
        haptic.medium();
        tg?.close?.();
        return;
      }

      // Свайп вправо от левого края (≤ 30px) ≥ 80px → кнопка «Назад»
      if (startX <= 30 && dx >= 80 && Math.abs(dy) < 80) {
        const { openPatientId: pid } = useUIStore.getState();
        if (pid) {
          haptic.light();
          closePatient();
          closeDraft();
        }
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [tg]); // eslint-disable-line

  useEffect(() => {
    // Сначала инициализируем клинику, потом грузим пациентов
    initClinics().then(() => fetchPatients());

    // Deep linking: открываем пациента если ID есть в URL (например ?pid=123 или #pid=123)
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const pid = params.get('pid') || params.get('id');
    if (pid) {
      const { openPatient } = useUIStore.getState();
      openPatient(pid);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!openPatientId) {
      closeDraft();
      setCardLoading(false);
      return;
    }

    // Защита от невалидных ID
    if (!openPatientId || openPatientId === 'undefined' || openPatientId === '') {
      closePatient();
      return;
    }

    // Фиксируем activeEye для катаракты на одном глазу
    const fixEye = (p: any) => {
      if (p?.type === 'cataract' && p.eye !== 'OU') {
        setActiveEye(p.eye === 'OS' ? 'os' : 'od');
      }
    };

    // Мгновенно показываем базовые данные из списка (или из fullData-кэша)
    const summary = patients.find(p => String(p.id) === String(openPatientId))
                 ?? fullData[openPatientId];
    if (summary) {
      openDraft(summary as any);
      fixEye(summary);
      setCardLoading(false);
    } else {
      setCardLoading(true);
    }

    // Подгружаем полные данные с измерениями
    fetchPatientFull(openPatientId)
      .then(patient => { if (patient) { openDraft(patient); fixEye(patient); } })
      .catch(console.error)
      .finally(() => setCardLoading(false));

  }, [openPatientId]); // eslint-disable-line

  const handleBack = () => { closePatient(); closeDraft(); };
  const activeLabel = NAV_ITEMS.find(n => n.key === navTab)?.label ?? '';
  const showCard = !!openPatientId;
  const showSkeleton = showCard && cardLoading && !draft;

  return (
    <>
      <GlobalStyles />
      <div style={{
        fontFamily: F.sans, background: C.bg, height: '100dvh',
        maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column',
        position: 'relative', boxShadow: '0 0 80px #00000080', overflow: 'hidden',
      }}>

        {/* Экран инициализации клиники */}
        {!initialized && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 200,
            background: C.bg, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: `3px solid ${C.surface2}`, borderTopColor: C.accent,
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontFamily: F.sans, fontSize: 13, color: C.muted }}>
              Подключение к клинике...
            </span>
          </div>
        )}

        {/* Ошибка: пользователь не зарегистрирован */}
        {initialized && clinicError && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 200,
            background: C.bg, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
          }}>
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.sans, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                Нет доступа
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                {clinicError}
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 12, opacity: 0.6 }}>
                Обратитесь к администратору клиники
              </div>
            </div>
          </div>
        )}

        <AppHeader title={activeLabel} />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {navTab === 'patients'   && <PatientsPage />}
          {navTab === 'operations' && <OperationsPage />}
          {navTab === 'results'    && <ResultsPage />}
        </div>

        <BottomNav />
        <SettingsModal />

        {showSkeleton && <CardSkeleton onBack={handleBack} />}
        {showCard && !showSkeleton && (
          <HooksErrorBoundary key={openPatientId!}>
            <PatientCard />
          </HooksErrorBoundary>
        )}
        <OCRModal />
      </div>
    </>
  );
}
