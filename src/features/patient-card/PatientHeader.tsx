import React from 'react';
import { C, F, R } from '../../constants/design';
import { useSessionStore } from '../../store/useSessionStore';
import { useUIStore } from '../../store/useUIStore';
import { useTelegram } from '../../hooks/useTelegram';
import { useClinicStore } from '../../store/useClinicStore';
import { T } from '../../constants/translations';
import type { TabKey } from '../../types/patient';

interface PatientHeaderProps {
  onSave: () => void;
  isSaving: boolean;
}

const TAB_LABELS: Record<TabKey, { ref: string; cat: string }> = {
  bio: { ref: 'EXAM', cat: 'BIO' },
  calc: { ref: 'IOL', cat: 'IOL' },
  plan: { ref: 'PLAN', cat: 'PLAN' },
  result: { ref: 'OUTCOME', cat: 'OUTCOME' },
  enhancement: { ref: 'ENH', cat: 'ENH' },
};

export function PatientHeader({ onSave, isSaving }: PatientHeaderProps) {
  const { draft, setDraft } = useSessionStore();
  const { activeTab, setActiveTab, closePatient, openOCR, targetSection } = useUIStore();
  const { language, theme } = useClinicStore();
  void theme; // подписка на смену темы → ре-рендер
  const t = T(language);
  const { haptic } = useTelegram();

  const [enhUnlocked, setEnhUnlocked] = React.useState(false);
  const pressTimer = React.useRef<any>(null);

  if (!draft) return null;

  const isCat = draft.type === 'cataract';
  const tabs: TabKey[] = isCat
    ? ['bio', 'calc', 'plan', 'result']
    : ['bio', 'plan', 'result', 'enhancement'];

  const typeColor = isCat ? C.cat : C.ref;
  const typeLabel = (isCat ? t.cataract : t.refraction).toUpperCase();

  const handleTabPress = (t: TabKey) => {
    if (t === 'enhancement' && !enhUnlocked) return;
    haptic.light();
    setActiveTab(t);
  };

  const startEnhPress = () => {
    pressTimer.current = setTimeout(() => {
      haptic.medium();
      setEnhUnlocked(true);
      setActiveTab('enhancement');
    }, 600);
  };

  const endEnhPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  return (
    <div
      style={{
        background: `linear-gradient(to bottom, ${C.surface} 0%, ${C.bg} 100%)`,
        padding: 'max(20px, env(safe-area-inset-top, 0px)) 16px 0',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 10,
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Main Row: BACK + NAME + SAVE */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <button
          onClick={closePatient}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: C.surface2, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.muted2, flexShrink: 0,
          }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            value={draft.name ?? ''}
            onChange={e => setDraft({ name: e.target.value })}
            placeholder={t.fullName}
            style={{
              fontFamily: F.sans, fontSize: 17, fontWeight: 800,
              color: C.text, background: 'transparent',
              border: 'none', outline: 'none',
              width: '100%', padding: 0, textAlign: 'center',
              letterSpacing: '-0.02em', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
            }}
          />
        </div>

        {/* Spacer for symmetry in top row */}
        <div style={{ width: 36, height: 36, flexShrink: 0 }} />
      </div>

      {/* Second Row: TYPE (Left) + AGE/SEX (Center) */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, position: 'relative', minHeight: 24 }}>

        <button
          onClick={() => {
            haptic.medium();
            setDraft({ type: isCat ? 'refraction' : 'cataract' });
          }}
          style={{
            background: isCat
              ? `linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)`
              : `linear-gradient(135deg, ${C.indigo} 0%, #6366F1 100%)`,
            border: `1px solid ${C.border2}`,
            borderRadius: 10, padding: '6px 16px',
            fontFamily: F.sans, fontSize: 9, fontWeight: 900,
            color: '#FFFFFF', cursor: 'pointer',
            letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: 120,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF', flexShrink: 0 }} />
          <span style={{ textAlign: 'center' }}>{typeLabel}</span>
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: draft.sex === 'Ж' ? 'rgba(244, 114, 182, 0.1)' : draft.sex === 'М' ? 'rgba(37, 99, 235, 0.1)' : C.surface2,
          padding: '4px 14px', borderRadius: 12,
          border: `1px solid ${draft.sex === 'Ж' ? 'rgba(244, 114, 182, 0.2)' : draft.sex === 'М' ? 'rgba(37, 99, 235, 0.3)' : C.border}`,
          position: 'absolute', left: '50%', transform: 'translateX(calc(-50% + 10px))',
          transition: 'all 0.3s',
          zIndex: 5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: F.sans, fontSize: 9.5, fontWeight: 900, color: C.muted2 }}>A</span>
            <input
              type="number" value={draft.age ?? ''}
              onChange={e => setDraft({ age: e.target.value })}
              placeholder="00"
              inputMode="numeric"
              style={{
                width: 24, fontFamily: F.mono, fontSize: 13, color: C.text,
                background: 'transparent', border: 'none', textAlign: 'center', outline: 'none', fontWeight: 900, padding: 0
              }}
            />
          </div>
          <div style={{ width: 1, height: 12, background: C.border }} />
          <button
            onClick={() => setDraft({ sex: draft.sex === 'М' ? 'Ж' : draft.sex === 'Ж' ? undefined : 'М' })}
            style={{
              background: 'transparent', border: 'none',
              fontFamily: F.sans, fontSize: 10.5, fontWeight: 900,
              color: draft.sex === 'Ж' ? '#F472B6' : draft.sex === 'М' ? '#3B82F6' : C.muted2,
              cursor: 'pointer', padding: 0, letterSpacing: '0.04em'
            }}
          >
            {draft.sex === 'М' ? t.male : draft.sex === 'Ж' ? t.female : t.gender + '?'}
          </button>
        </div>

        {/* Squashed SAVE Button - Symmetrical with Type Button */}
        <button
          onClick={() => { haptic.medium(); onSave(); }}
          disabled={isSaving}
          style={{
            marginLeft: 'auto',
            background: isSaving ? C.surface : `linear-gradient(135deg, ${C.green} 0%, #10B981 100%)`,
            border: `1px solid ${C.border2}`,
            borderRadius: 10, padding: '6px 16px',
            fontFamily: F.sans, fontSize: 9, fontWeight: 900,
            color: '#FFFFFF', cursor: 'pointer',
            letterSpacing: '0.12em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          {isSaving ? (
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '2px', background: '#FFF', flexShrink: 0 }} />
              <span>{t.save}</span>
            </>
          )}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const active = activeTab === t;
            const isEnh = t === 'enhancement';
            const isLocked = isEnh && !enhUnlocked;

            return (
              <button
                key={t}
                onClick={() => handleTabPress(t)}
                onPointerDown={isEnh ? startEnhPress : undefined}
                onPointerUp={isEnh ? endEnhPress : undefined}
                onPointerLeave={isEnh ? endEnhPress : undefined}
                style={{
                  flex: 1, padding: '12px 4px', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: F.sans, fontSize: 11,
                  fontWeight: active ? 900 : 600,
                  color: active ? C.text : C.muted2,
                  borderBottom: `3px solid ${active ? C.indigo : 'transparent'}`,
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                  opacity: active ? 1 : isLocked ? 0.2 : 0.5,
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                }}
              >
                {isLocked && (
                  <svg width="10" height="10" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.6">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                )}
                {TAB_LABELS[t][isCat ? 'cat' : 'ref']}
              </button>
            );
          })}
        </div>

        {/* Unified Scan OCR Trigger */}
        <button
          onClick={() => activeTab !== 'plan' && (haptic.light(), openOCR(targetSection ?? undefined))}
          disabled={activeTab === 'plan'}
          style={{
            height: 34, padding: '0 14px', borderRadius: '12px 12px 0 0',
            background: activeTab === 'plan' ? 'transparent' : (targetSection ? `${C.indigo}20` : C.surface2),
            border: `1px solid ${activeTab === 'plan' ? `${C.border}40` : C.border}`, borderBottom: 'none',
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: activeTab === 'plan' ? 'default' : 'pointer', transition: 'all 0.2s',
            marginBottom: -1,
            opacity: activeTab === 'plan' ? 0.3 : 1
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={activeTab === 'plan' ? `${C.muted2}40` : (targetSection ? C.indigo : C.muted2)} strokeWidth="2.5">
            <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
          </svg>
          <span style={{
            fontFamily: F.mono, fontSize: 10, fontWeight: 800,
            color: activeTab === 'plan' ? `${C.muted2}40` : (targetSection ? C.indigo : C.muted2), textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            OCR
          </span>
        </button>
      </div>
    </div>
  );
}
