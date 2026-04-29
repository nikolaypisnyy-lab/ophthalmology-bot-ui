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
import { NewPatientModal } from './features/patient-card/NewPatientModal';
import { useClinicStore } from './store/useClinicStore';
import { T } from './constants/translations';

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
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
      
      *, *::before, *::after { 
        box-sizing: border-box; 
        margin: 0; 
        padding: 0; 
        -webkit-tap-highlight-color: transparent;
      }
      
      html, body, #root { 
        width: 100%;
        height: 100%; 
        background: ${C.bg};
        overscroll-behavior: none;
      }
      
      body { 
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        color: ${C.text}; 
        font-family: 'Outfit', system-ui, sans-serif; 
        -webkit-font-smoothing: antialiased; 
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }

      input, textarea {
        user-select: text !important;
        -webkit-user-select: text !important;
      }

      input, textarea, select { font-family: 'Outfit', sans-serif; }
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

const getNavItems = (t: any) => [
  {
    key: 'patients' as const,
    label: t.all,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    ),
  },
  {
    key: 'operations' as const,
    label: t.surgery,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
  {
    key: 'results' as const,
    label: t.resultsTitle,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
];

function AppHeader({ title }: { title: string }) {
  const { openSettings } = useUIStore();
  const { activeName } = useClinicStore();
  const { haptic } = useTelegram();
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
          fontWeight: 700, 
          color: C.indigo, 
          letterSpacing: '.12em', 
          textTransform: 'uppercase',
          marginBottom: 2
        }}>
          RefMaster 2.0 <span style={{ opacity: 0.5, color: C.muted2 }}>/ {activeName || 'MedEye'}</span>
        </div>
        <div style={{ 
          fontFamily: F.sans, 
          fontSize: 24, 
          fontWeight: 900, 
          color: C.text,
          letterSpacing: '-0.03em',
        }}>
          {title}
        </div>
      </div>
      <div 
        onClick={() => { haptic.light(); openSettings(); }}
        style={{
          width: 42, height: 42, borderRadius: 14,
          background: C.surface,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={C.muted2} strokeWidth="2.5">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
    </div>
  );
}

function BottomNav() {
  const { navTab, setNavTab } = useUIStore();
  const { language } = useClinicStore();
  const { haptic } = useTelegram();
  const t = T(language);
  const items = getNavItems(t);
  
  return (
    <div style={{
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)',
      background: 'rgba(5, 6, 12, 0.95)',
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
      borderTop: `1px solid ${C.border}`,
      paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
      paddingTop: 10,
      height: 84,
      flexShrink: 0,
    }}>
      {items.map(item => {
        const active = navTab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => { haptic.selection(); setNavTab(item.key); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 5, padding: '6px 0',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: active ? C.indigo : C.muted2,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 24, height: 24, opacity: active ? 1 : 0.5, transition: 'all 0.2s', transform: active ? 'scale(1.1)' : 'scale(1)' }}>
              {item.icon}
            </div>
            <span style={{ 
              fontFamily: F.sans, 
              fontSize: 10, 
              fontWeight: active ? 900 : 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              opacity: active ? 1 : 0.6
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function KeyboardHidden({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const initialHeight = window.innerHeight;
    const handleResize = () => {
      setVisible(window.innerHeight > initialHeight * 0.75);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  if (!visible) return null;
  return <>{children}</>;
}

// ── Скелетон загрузки ─────────────────────────────────────────────────────────

function CardSkeleton({ onBack, t }: { onBack: () => void; t: any }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1100,
      background: C.bg, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        background: `linear-gradient(to bottom, #111425 0%, #0a0d16 100%)`,
        padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px 12px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '8px 14px',
              cursor: 'pointer', color: C.muted2,
              fontFamily: F.sans, fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}
          >
            ← {t.back}
          </button>
          <div style={{ flex: 1, height: 20, background: C.surface, borderRadius: 8, opacity: 0.3 }} />
        </div>
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${C.surface}`, borderTopColor: C.indigo,
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ fontFamily: F.sans, fontSize: 14, color: C.muted2, fontWeight: 600 }}>
          {t.loading}
        </span>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export function App() {
  const { 
    navTab, openPatientId, ocrOpen, settingsOpen, 
    showNewPatientModal, closeNewPatient, closeSettings, closeOCR, closePatient, setActiveEye 
  } = useUIStore();
  
  const { patients, fetchPatients, fullData, fetchPatientFull } = usePatientStore();
  const { openDraft, closeDraft, draft } = useSessionStore();
  const { initClinics, initialized, error: clinicError, language } = useClinicStore();
  const [cardLoading, setCardLoading] = useState(false);
  const { tg, haptic } = useTelegram();
  const t = T(language);

  // Поддержка нативной кнопки "Назад" в Telegram
  useEffect(() => {
    const handleBackBtn = () => {
      haptic.light();
      const state = useUIStore.getState();
      if (state.ocrOpen) state.closeOCR();
      else if (state.settingsOpen) state.closeSettings();
      else if (state.openPatientId) state.closePatient();
    };

    const shouldShowBack = ocrOpen || settingsOpen || !!openPatientId;
    
    if (tg && tg.isVersionAtLeast('6.1') && tg.BackButton) {
      tg.BackButton.onClick(handleBackBtn);
      if (shouldShowBack) tg.BackButton.show(); else tg.BackButton.hide();
    }
    
    return () => { 
      if (tg && tg.isVersionAtLeast('6.1') && tg.BackButton) {
        tg.BackButton.offClick(handleBackBtn);
      }
    };
  }, [haptic, tg, openPatientId, settingsOpen, ocrOpen]);

  // Свайп от края (Edge Swipe)
  const [edgeTouchStart, setEdgeTouchStart] = useState<{ x: number, y: number } | null>(null);
  const [edgeProgress, setEdgeProgress] = useState(0);

  const handleEdgeTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0].clientX < 40) {
      setEdgeTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setEdgeProgress(0);
    }
  };

  const handleEdgeTouchMove = (e: React.TouchEvent) => {
    if (!edgeTouchStart) return;
    const deltaX = e.touches[0].clientX - edgeTouchStart.x;
    const deltaY = Math.abs(e.touches[0].clientY - edgeTouchStart.y);
    
    if (deltaX > 0 && deltaY < 100) {
      setEdgeProgress(deltaX);
    }
  };

  const handleEdgeTouchEnd = () => {
    if (edgeTouchStart && edgeProgress > 80) {
      haptic.notification('success');
      if (ocrOpen) closeOCR(); 
      else if (settingsOpen) closeSettings(); 
      else if (openPatientId) closePatient();
      else if (showNewPatientModal) closeNewPatient();
    }
    setEdgeTouchStart(null);
    setEdgeProgress(0);
  };

  useEffect(() => {
    initClinics().then(() => fetchPatients());
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const pid = params.get('pid') || params.get('id');
    if (pid) { useUIStore.getState().openPatient(pid); }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!openPatientId) { closeDraft(); setCardLoading(false); return; }
    if (!openPatientId || openPatientId === 'undefined') { closePatient(); return; }

    const fixEye = (p: any) => {
      if (p?.type === 'cataract' && p.eye !== 'OU') {
        setActiveEye(p.eye === 'OS' ? 'os' : 'od');
      }
    };

    const summary = patients.find(p => String(p.id) === String(openPatientId)) ?? fullData[openPatientId];
    if (summary) {
      openDraft(summary as any); fixEye(summary); setCardLoading(false);
    } else {
      setCardLoading(true);
    }

    fetchPatientFull(openPatientId)
      .then(patient => { if (patient) { openDraft(patient); fixEye(patient); } })
      .catch(console.error)
      .finally(() => setCardLoading(false));

  }, [openPatientId]); // eslint-disable-line

  const handleBack = () => { haptic.light(); closePatient(); closeDraft(); };
  const items = getNavItems(t);
  const activeLabel = items.find(n => n.key === navTab)?.label ?? '';

  return (
    <HooksErrorBoundary>
      <GlobalStyles />
      <div id="app-root" style={{
        background: `radial-gradient(ellipse at 20% 0%, rgba(129, 140, 248, 0.12), transparent 50%),
                     radial-gradient(ellipse at 80% 100%, rgba(59, 130, 246, 0.08), transparent 50%),
                     ${C.bg}`,
        height: '100dvh', maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column', position: 'relative', 
        boxShadow: '0 0 100px rgba(0,0,0,0.9)', overflow: 'hidden',
      }}>

        {!initialized ? (
          <div style={{ position: 'absolute', inset: 0, zIndex: 999, background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${C.surface}`, borderTopColor: C.indigo, animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 14, color: C.muted2, fontWeight: 600 }}>MedEye Bot Connect...</span>
          </div>
        ) : clinicError ? (
          <div style={{ position: 'absolute', inset: 0, zIndex: 999, background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
            <svg width="60" height="60" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 8 }}>{t.accessDenied}</div>
              <div style={{ fontSize: 14, color: C.muted2, lineHeight: 1.5 }}>{clinicError}</div>
              <button onClick={() => window.location.reload()} style={{ marginTop: 24, padding: '12px 24px', borderRadius: 14, background: C.indigo, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800 }}>{t.retry}</button>
            </div>
          </div>
        ) : (
          <>
            {(ocrOpen || settingsOpen || !!openPatientId || showNewPatientModal) && (
              <div 
                style={{ position: 'fixed', top: 0, left: 0, width: 40, height: '100%', zIndex: 99999, touchAction: 'none' }} 
                onTouchStart={handleEdgeTouchStart} 
                onTouchMove={handleEdgeTouchMove} 
                onTouchEnd={handleEdgeTouchEnd}
                onTouchCancel={handleEdgeTouchEnd}
              />
            )}
            
            <AppHeader title={activeLabel} />

            <div id="page-container" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 900 }}>
              {navTab === 'patients'   && <PatientsPage />}
              {navTab === 'operations' && <OperationsPage />}
              {navTab === 'results'    && <ResultsPage />}
            </div>

            {!(openPatientId || ocrOpen || settingsOpen || showNewPatientModal) && (
              <KeyboardHidden>
                <BottomNav />
              </KeyboardHidden>
            )}

            {openPatientId && <PatientCard />}
            {settingsOpen && <SettingsModal />}
            {showNewPatientModal && <NewPatientModal />}
            {ocrOpen && <OCRModal />}
            {cardLoading && <CardSkeleton onBack={handleBack} t={t} />}
          </>
        )}
      </div>
    </HooksErrorBoundary>
  );
}
