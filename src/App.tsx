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
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
      
      *, *::before, *::after { 
        box-sizing: border-box; 
        margin: 0; 
        padding: 0; 
        -webkit-tap-highlight-color: transparent;
      }
      
      html, body, #root { 
        height: 100%; 
        background: ${C.bg};
      }
      
      body { 
        color: ${C.text}; 
        font-family: ${F.sans}; 
        -webkit-font-smoothing: antialiased; 
        overflow: hidden;
      }

      input, textarea, select { font-family: ${F.sans}; }
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      input[type=number] { -moz-appearance: textfield; }

      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 10px; }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .su { animation: slideUp .3s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
      .fi { animation: fadeIn .3s ease both; }
    `}</style>
  );
}

// ── Навигация ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    key: 'patients' as const,
    label: 'Patients',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 110-8 4 4 0 010 8zM15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
    ),
  },
  {
    key: 'operations' as const,
    label: 'Surgery',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
    ),
  },
  {
    key: 'results' as const,
    label: 'Results',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>
    ),
  },
];

function AppHeader({ title }: { title: string }) {
  const { openSettings } = useUIStore();
  return (
    <div style={{
      background: 'transparent',
      padding: 'max(24px, env(safe-area-inset-top, 0px)) 20px 14px',
      borderBottom: `1px solid ${C.border}`,
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    }}>
      <div style={{ cursor: 'default' }}>
        <div style={{ 
          fontFamily: F.mono, 
          fontSize: 10, 
          fontWeight: 500, 
          color: C.muted2, 
          letterSpacing: '.12em', 
          textTransform: 'uppercase',
          marginBottom: 2
        }}>
          RefMaster 2.0 <span style={{ opacity: 0.5 }}>/ Clinical View</span>
        </div>
        <div style={{ 
          fontFamily: F.sans, 
          fontSize: 22, 
          fontWeight: 600, 
          color: C.text,
          letterSpacing: '-0.02em',
        }}>
          {title}
        </div>
      </div>
      <div 
        onClick={openSettings}
        style={{
          width: 38, height: 38, borderRadius: 12,
          background: C.surface,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.muted} strokeWidth="2">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
    </div>
  );
}

function BottomNav() {
  const { navTab, setNavTab } = useUIStore();
  return (
    <div style={{
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)',
      background: 'rgba(13, 15, 26, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${C.border}`,
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
      paddingTop: 8,
      height: 84,
      flexShrink: 0,
    }}>
      {NAV_ITEMS.map(item => {
        const active = navTab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => setNavTab(item.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '6px 0',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: active ? C.indigo : C.muted2,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 22, height: 22, opacity: active ? 1 : 0.6 }}>
              {item.icon}
            </div>
            <span style={{ 
              fontFamily: F.sans, 
              fontSize: 10, 
              fontWeight: active ? 700 : 500,
              letterSpacing: '0.02em',
              opacity: active ? 1 : 0.7
            }}>
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
      position: 'absolute', inset: 0, zIndex: 1100,
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
            ← Back
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
          Loading...
        </span>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

console.log("RefMaster Build:", Date.now());

export function App() {
  const { navTab, openPatientId, closePatient, setActiveEye, openSettings, settingsOpen, ocrOpen } = useUIStore();
  const { fetchPatients, fetchPatientFull, patients, fullData } = usePatientStore();
  const { openDraft, closeDraft, draft } = useSessionStore();
  const { initClinics, initialized, error: clinicError } = useClinicStore();
  const [cardLoading, setCardLoading] = useState(false);

  const { tg, haptic } = useTelegram();

  // Поддержка нативной кнопки "Назад" в Telegram (которая автоматически обрабатывает системный iOS свайп от края)
  useEffect(() => {
    const handleBackBtn = () => {
      haptic.light();
      const state = useUIStore.getState();
      if (state.ocrOpen) state.closeOCR();
      else if (state.settingsOpen) state.closeSettings();
      else if (state.openPatientId) state.closePatient();
    };

    if (tg && tg.BackButton) {
      tg.BackButton.onClick(handleBackBtn);
      
      const shouldShowBack = ocrOpen || settingsOpen || !!openPatientId;
      if (shouldShowBack) {
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
    }
    
    return () => {
      if (tg && tg.BackButton) {
        tg.BackButton.offClick(handleBackBtn);
      }
    };
  }, [haptic, tg, openPatientId, settingsOpen, ocrOpen]);

  // Резервный "прозрачный край" для ручного свайпа, если нативная кнопка не перехватывает
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleEdgeTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleEdgeTouchMove = (e: React.TouchEvent) => {
    if (touchStartX !== null && e.touches[0].clientX - touchStartX > 50) {
      haptic.selection();
      setTouchStartX(null);
      if (ocrOpen) closeOCR();
      else if (settingsOpen) closeSettings();
      else if (openPatientId) closePatient();
    }
  };
  const handleEdgeTouchEnd = () => setTouchStartX(null);

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
    if (!openPatientId) {
      if (draft) { closeDraft(); }
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

  return (
    <>
      <GlobalStyles />
      <div id="app-root" style={{
        fontFamily: F.sans, 
        background: `radial-gradient(ellipse at 20% 0%, rgba(129, 140, 248, 0.08), transparent 50%),
                     radial-gradient(ellipse at 80% 100%, rgba(59, 130, 246, 0.05), transparent 50%),
                     ${C.bg}`,
        height: '100dvh',
        maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column',
        position: 'relative', 
        boxShadow: '0 0 120px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }}>

        {!initialized ? (
          <div id="init-loading" style={{
            position: 'absolute', inset: 0, zIndex: 999,
            background: C.bg, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: `3px solid ${C.surface2}`, borderTopColor: C.accent,
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontFamily: F.sans, fontSize: 13, color: C.muted }}>
              Connecting to clinic...
            </span>
          </div>
        ) : clinicError ? (
          <div id="clinic-error" style={{
            position: 'absolute', inset: 0, zIndex: 999,
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
                Access Denied
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                {clinicError}
              </div>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  marginTop: 20, padding: '10px 20px', borderRadius: 12,
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.text, fontFamily: F.sans, fontSize: 13, fontWeight: 600
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Прозрачный край для гарантированного ручного свайпа назад */}
            {(ocrOpen || settingsOpen || !!openPatientId) && (
              <div
                style={{
                  position: 'fixed', top: 0, left: 0, width: 25, height: '100%', zIndex: 99999, touchAction: 'none'
                }}
                onTouchStart={handleEdgeTouchStart}
                onTouchMove={handleEdgeTouchMove}
                onTouchEnd={handleEdgeTouchEnd}
                onTouchCancel={handleEdgeTouchEnd}
              />
            )}
            
            <AppHeader title={activeLabel} />

            <div id="page-container" style={{ 
              flex: 1, 
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column',
              position: 'relative',
              zIndex: 900
            }}>
              {navTab === 'patients'   && <PatientsPage />}
              {navTab === 'operations' && <OperationsPage />}
              {navTab === 'results'    && <ResultsPage />}
            </div>

            <BottomNav />

            {openPatientId && <PatientCard />}

            {/* ГЛОБАЛЬНЫЕ МОДАЛКИ */}
            {useUIStore.getState().ocrOpen && <OCRModal />}
            {useUIStore.getState().settingsOpen && <SettingsModal />}

            {/* СКЕЛЕТОН ЗАГРУЗКИ КАРТОЧКИ */}
            {cardLoading && <CardSkeleton onBack={handleBack} />}
          </>
        )}
      </div>
    </>
  );
}
