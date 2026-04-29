import React, { useState, useRef } from 'react';
import { C, F } from '../../constants/design';
import { useSessionStore } from '../../store/useSessionStore';
import { useUIStore } from '../../store/useUIStore';
import { useClinicStore } from '../../store/useClinicStore';
import { useTelegram } from '../../hooks/useTelegram';
import type { TabKey } from '../../types/patient';
import { T } from '../../constants/translations';

interface PatientHeaderProps {
  onSave: () => void;
  isSaving: boolean;
}

export function PatientHeader({ onSave, isSaving }: PatientHeaderProps) {
  const { draft, setDraft } = useSessionStore();
  const { activeTab, setActiveTab, closePatient, openOCR, targetSection } = useUIStore();
  const { language, setLanguage } = useClinicStore();
  const { haptic } = useTelegram();
  const t = T(language);

  const [enhUnlocked, setEnhUnlocked] = useState(false);
  const pressTimer = useRef<any>(null);

  if (!draft) return null;

  const isCat = draft.type === 'cataract';
  const tabs: TabKey[] = isCat
    ? ['bio', 'calc', 'plan', 'result']
    : ['bio', 'plan', 'result', 'enhancement'];

  const typeLabel = isCat ? t.cataract : t.refraction;

  const handleTabPress = (tKey: TabKey) => {
    if (tKey === 'enhancement' && !enhUnlocked) return;
    haptic.selection();
    setActiveTab(tKey);
  };

  const startEnhPress = () => {
    pressTimer.current = setTimeout(() => {
      haptic.notification('success');
      const nextLocked = !enhUnlocked;
      setEnhUnlocked(nextLocked);
      if (nextLocked) {
        setActiveTab('enhancement');
      } else if (activeTab === 'enhancement') {
        setActiveTab('result');
      }
    }, 800);
  };

  const endEnhPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  return (
    <div
      style={{
        background: `linear-gradient(to bottom, #0f0e21 0%, #05060c 100%)`,
        padding: 'max(20px, env(safe-area-inset-top, 0px)) 16px 0',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        zIndex: 10,
        userSelect: 'none',
      }}
    >
      {/* Main Row: BACK + NAME */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button
          onClick={() => { haptic.light(); closePatient(); }}
          style={{
            width: 38, height: 38, borderRadius: 14,
            background: C.surface, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.muted2, flexShrink: 0,
          }}
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={draft.name ?? ''}
            onChange={e => setDraft({ name: e.target.value })}
            placeholder={t.fullName}
            style={{
              fontFamily: F.sans, fontSize: 20, fontWeight: 900,
              color: C.text, background: 'transparent',
              border: 'none', outline: 'none',
              width: '100%', padding: 0, textAlign: 'center',
              letterSpacing: '-0.02em'
            }}
          />
        </div>

        {/* Spacer to balance the back button for centering */}
        <div style={{ width: 38, flexShrink: 0 }} />
      </div>

      {/* Second Row: TYPE + AGE/SEX + SAVE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 18, minHeight: 32 }}>
        <button
          onClick={() => {
            haptic.impact('medium');
            setDraft({ type: isCat ? 'refraction' : 'cataract' });
          }}
          style={{
            background: isCat ? '#1e40af' : C.indigo,
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: 12, padding: '8px 14px',
            fontFamily: F.sans, fontSize: 10, fontWeight: 900,
            color: '#FFFFFF', cursor: 'pointer',
            letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.3s', minWidth: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            flexShrink: 0
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF' }} />
          <span>{typeLabel.toUpperCase()}</span>
        </button>

        {/* AGE/SEX Dashboard - Ultra Narrow */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
          background: draft.sex === 'Ж' ? 'rgba(236,72,153,0.1)' : draft.sex === 'М' ? 'rgba(59,130,246,0.1)' : `${C.surface}80`,
          padding: '6px 8px', borderRadius: 14,
          border: `1px solid ${draft.sex === 'Ж' ? 'rgba(236,72,153,0.3)' : draft.sex === 'М' ? 'rgba(59,130,246,0.3)' : C.border}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <input
            type="number" value={draft.age ?? ''}
            onChange={e => setDraft({ age: e.target.value })}
            placeholder="00"
            style={{
              width: 20, fontFamily: F.mono, fontSize: 13, color: C.text,
              background: 'transparent', border: 'none', textAlign: 'center', outline: 'none', fontWeight: 900, padding: 0
            }}
          />
          <div style={{ width: 1, height: 10, background: C.border, opacity: 0.4 }} />
          <button
            onClick={() => { haptic.light(); setDraft({ sex: draft.sex === 'М' ? 'Ж' : draft.sex === 'Ж' ? undefined : 'М' }); }}
            style={{
              background: 'transparent', border: 'none',
              fontFamily: F.sans, fontSize: 10, fontWeight: 900,
              color: draft.sex === 'Ж' ? '#ec4899' : draft.sex === 'М' ? '#3b82f6' : C.muted2,
              cursor: 'pointer', padding: 0, transition: 'color 0.2s',
              minWidth: 12
            }}
          >
            {draft.sex === 'М' ? 'М' : draft.sex === 'Ж' ? 'Ж' : '?'}
          </button>
        </div>

        {/* Eye selector — OD / OS / OU */}
        {isCat && (() => {
          const eyeVal = (draft.eye || 'OU').toUpperCase() as 'OD' | 'OS' | 'OU';
          const next: Record<string, string> = { 'OU': 'OD', 'OD': 'OS', 'OS': 'OU' };
          const eyeClr = eyeVal === 'OD' ? C.od : eyeVal === 'OS' ? C.os : C.indigo;
          return (
            <button
              onClick={() => { haptic.impact('medium'); setDraft({ eye: next[eyeVal] as any }); }}
              style={{
                padding: '8px 12px', borderRadius: 12, flexShrink: 0,
                background: `${eyeClr}18`, border: `1px solid ${eyeClr}45`,
                fontFamily: F.mono, fontSize: 11, fontWeight: 900,
                color: eyeClr, cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >{eyeVal}</button>
          );
        })()}

        <button
          onClick={() => { haptic.notification('success'); onSave(); }}
          disabled={isSaving}
          style={{
            padding: '8px 16px', borderRadius: 12,
            background: isSaving ? C.surface : `linear-gradient(135deg, ${C.indigo} 0%, #4338ca 100%)`,
            border: 'none', color: '#fff',
            fontFamily: F.sans, fontSize: 10, fontWeight: 900,
            cursor: 'pointer', transition: 'all 0.3s',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            letterSpacing: '0.06em', minWidth: 100, justifyContent: 'center',
            boxShadow: isSaving ? 'none' : `0 4px 12px ${C.indigo}40`
          }}
        >
          {isSaving ? (
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff3', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFF', opacity: 0.8 }} />
              {t.save.toUpperCase()}
            </>
          )}
        </button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {tabs.map(tk => {
            const active = activeTab === tk;
            const isEnh = tk === 'enhancement';
            const isLocked = isEnh && !enhUnlocked;

            return (
              <button
                key={tk}
                onClick={() => handleTabPress(tk)}
                onPointerDown={isEnh ? startEnhPress : undefined}
                onPointerUp={isEnh ? endEnhPress : undefined}
                style={{
                  flex: 1, padding: '14px 6px', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: F.sans, fontSize: 12,
                  fontWeight: active ? 900 : 700,
                  color: active ? C.text : C.muted2,
                  borderBottom: `3.5px solid ${active ? C.indigo : 'transparent'}`,
                  transition: 'all 0.25s', whiteSpace: 'nowrap',
                  opacity: active ? 1 : isLocked ? 0.3 : 0.6,
                  textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  WebkitTouchCallout: 'none', WebkitUserSelect: 'none',
                  touchAction: 'manipulation'
                }}
                onContextMenu={(e) => isEnh && e.preventDefault()}
              >
                {isLocked && (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                )}
                {(t as any)[tk] || tk.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* OCR Button with Badge */}
        <button
          onClick={() => activeTab !== 'plan' && (haptic.light(), openOCR(targetSection ?? undefined))}
          disabled={activeTab === 'plan'}
          style={{
            height: 38, padding: '0 14px', borderRadius: '14px 14px 0 0',
            background: activeTab === 'plan' ? 'transparent' : (targetSection ? `${C.indigo}25` : `${C.surface}80`),
            border: `1px solid ${C.border}`, borderBottom: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: activeTab === 'plan' ? 'default' : 'pointer',
            opacity: activeTab === 'plan' ? 0.3 : 1, marginBottom: -1,
            transition: 'all 0.2s'
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={targetSection ? C.indigo : C.muted2} strokeWidth="2.5">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {targetSection && (
              <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: C.indigo, border: `1.5px solid ${C.bg}` }} />
            )}
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 900, color: targetSection ? C.indigo : C.muted2 }}>OCR</span>
        </button>
      </div>
    </div>
  );
}
