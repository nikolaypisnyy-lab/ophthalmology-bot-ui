import React from 'react';
import { C, F } from '../../constants/design';
import { Btn } from '../../ui/Btn';
import { useSessionStore } from '../../store/useSessionStore';
import { useUIStore } from '../../store/useUIStore';
import { useTelegram } from '../../hooks/useTelegram';
import type { TabKey } from '../../types/patient';

interface PatientHeaderProps {
  onSave: () => void;
  isSaving: boolean;
}

const TAB_LABELS: Record<TabKey, { ref: string; cat: string }> = {
  bio:    { ref: 'Рефракция', cat: 'Биометрия' },
  calc:   { ref: 'Расчёт ИОЛ', cat: 'Расчёт ИОЛ' },
  plan:   { ref: 'План', cat: 'План' },
  result: { ref: 'Результат', cat: 'Результат' },
  enhancement: { ref: 'Докоррекция', cat: 'Докоррекция' },
};

export function PatientHeader({ onSave, isSaving }: PatientHeaderProps) {
  const { draft, setDraft } = useSessionStore();
  const { activeTab, setActiveTab, closePatient, openOCR, targetSection } = useUIStore();
  const { haptic } = useTelegram();

  if (!draft) return null;

  const isCat = draft.type === 'cataract';
  const tabs: TabKey[] = isCat
    ? ['bio', 'calc', 'plan', 'result']
    : ['bio', 'plan', 'result', 'enhancement'];

  const typeColor = isCat ? C.cat : C.ref;
  const typeLabel = isCat ? 'Катаракта' : 'Рефракция';
  const eyeColor  = draft.eye === 'OS' ? C.os : C.od;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg,#0d0c1a 0%,#16143a 100%)',
        padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px 0',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}
    >
      {/* Строка: назад + ФИО + сохранить */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={closePatient}
          style={{
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: '7px 12px',
            cursor: 'pointer', color: C.muted2,
            fontFamily: F.sans, fontSize: 13,
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>

        {/* Имя + мета */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={draft.name ?? ''}
            onChange={e => setDraft({ name: e.target.value })}
            placeholder="ФИО пациента"
            style={{
              fontFamily: F.sans, fontSize: 15, fontWeight: 700,
              color: C.text, background: 'transparent',
              border: 'none', outline: 'none',
              width: '100%', padding: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          />
          <div style={{
            fontFamily: F.sans, fontSize: 11, color: C.muted,
            marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
          }}>
            <input
              type="number"
              value={draft.age ?? ''}
              onChange={e => setDraft({ age: e.target.value })}
              placeholder="30"
              style={{
                width: 28, fontFamily: F.mono, fontSize: 11, color: C.text,
                background: 'rgba(255,255,255,.08)', border: `1px solid ${C.border2}`,
                borderRadius: 6, padding: '1px 4px', textAlign: 'center', outline: 'none',
              }}
            />
            <span>лет</span>
            <button
              onClick={() => setDraft({ sex: draft.sex === 'М' ? 'Ж' : draft.sex === 'Ж' ? undefined : 'М' })}
              style={{
                background: draft.sex === 'М'
                  ? 'linear-gradient(135deg, #1d4ed8, #3b82f6)'
                  : draft.sex === 'Ж'
                  ? 'linear-gradient(135deg, #be185d, #ec4899)'
                  : 'rgba(255,255,255,0.08)',
                border: draft.sex ? 'none' : `1px solid rgba(255,255,255,0.15)`,
                borderRadius: 8, padding: '1px 7px',
                fontFamily: F.sans, fontSize: 13, fontWeight: 700,
                color: draft.sex ? '#fff' : C.muted,
                cursor: 'pointer', lineHeight: '18px',
                boxShadow: draft.sex === 'М' ? '0 2px 8px rgba(59,130,246,0.4)'
                         : draft.sex === 'Ж' ? '0 2px 8px rgba(236,72,153,0.4)' : 'none',
              }}
            >
              {draft.sex === 'М' ? '♂' : draft.sex === 'Ж' ? '♀' : '?'}
            </button>
            <span style={{ opacity: 0.4 }}>·</span>
            {isCat
              ? <span style={{ color: eyeColor, fontWeight: 600 }}>{draft.eye}</span>
              : <>
                  <span style={{ color: C.od, fontWeight: 600 }}>OD</span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span style={{ color: C.os, fontWeight: 600 }}>OS</span>
                </>
            }
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ 
              display: 'flex', alignItems: 'center', gap: 5,
              background: typeColor + '18', padding: '1px 8px', borderRadius: 20,
              border: `1px solid ${typeColor}35`, color: typeColor, 
              fontWeight: 700, fontSize: 10
            }}>
              {typeLabel.toUpperCase()}
              <span style={{ opacity: 0.5, fontFamily: F.mono, letterSpacing: '0.2px' }}>#{draft.id}</span>
            </span>
          </div>
        </div>

        <Btn small variant="primary" onClick={() => { haptic.medium(); onSave(); }} disabled={isSaving}>
          {isSaving ? '...' : 'Сохранить'}
        </Btn>
      </div>

      {/* Табы + OCR */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Вкладки — скролл внутри, не вытесняют Скан */}
        <div style={{ flex: 1, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '9px 10px', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: F.sans, fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? C.text : C.muted,
                  borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                  transition: 'all .15s', whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {TAB_LABELS[t][isCat ? 'cat' : 'ref']}
              </button>
            );
          })}
        </div>

        {/* OCR кнопка — всегда видна справа */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center',
          paddingLeft: 6, paddingBottom: 2,
          borderBottom: '2px solid transparent',
        }}>
          <button
            onClick={() => openOCR(targetSection ?? undefined)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: `${C.accent}18`, border: `1.5px solid ${C.accent}45`,
              borderRadius: 20, padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={C.accent} strokeWidth="2">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" strokeDasharray="2 1.5" />
            </svg>
            <span style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, color: C.accent }}>
              Скан
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
