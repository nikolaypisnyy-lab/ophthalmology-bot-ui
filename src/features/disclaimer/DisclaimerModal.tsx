import { useState } from 'react';
import { C, F } from '../../constants/design';
import { useClinicStore } from '../../store/useClinicStore';

const LS_KEY = 'rm_disclaimer_v1';

export function useDisclaimerAccepted() {
  try { return !!localStorage.getItem(LS_KEY); } catch { return true; }
}

export function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  const { language } = useClinicStore();
  const ru = language === 'ru';
  const [checked, setChecked] = useState(false);

  const accept = () => {
    if (!checked) return;
    try { localStorage.setItem(LS_KEY, '1'); } catch {}
    onAccept();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: C.surface,
        borderRadius: '28px 28px 0 0',
        padding: '28px 24px calc(36px + env(safe-area-inset-bottom,0px))',
        borderTop: `1px solid ${C.border}`,
      }}>
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: `${C.warn}18`, border: `1px solid ${C.warn}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.warn} strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: F.sans, fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4 }}>
            {ru ? 'Медицинский дисклеймер' : 'Medical Disclaimer'}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.warn, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {ru ? 'Прочитайте перед использованием' : 'Read before use'}
          </div>
        </div>

        {/* Body */}
        <div style={{
          background: C.surface2, borderRadius: 16, padding: '16px',
          border: `1px solid ${C.border}`, marginBottom: 20,
          maxHeight: '35vh', overflowY: 'auto',
        }}>
          {ru ? (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.secondary, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: C.text }}>RefMaster 2.0</strong> — это инструмент поддержки клинических решений для квалифицированных специалистов. Приложение <strong style={{ color: C.text }}>не является медицинским устройством</strong> и не заменяет профессиональную медицинскую оценку.
              </p>
              <p style={{ margin: 0 }}>
                Все расчёты ИОЛ, планы лечения и рефракционные данные носят <strong style={{ color: C.text }}>справочный характер</strong>. Окончательное клиническое решение принимается исключительно лечащим врачом.
              </p>
              <p style={{ margin: 0, color: C.muted2 }}>
                Разработчики и правообладатели <strong style={{ color: C.muted }}>не несут ответственности</strong> за любые медицинские последствия, связанные с использованием данного ПО.
              </p>
            </div>
          ) : (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.secondary, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: C.text }}>RefMaster 2.0</strong> is a clinical decision support tool intended for qualified medical professionals. This application is <strong style={{ color: C.text }}>not a medical device</strong> and does not replace professional medical judgment.
              </p>
              <p style={{ margin: 0 }}>
                All IOL calculations, treatment plans, and refractive data are provided for <strong style={{ color: C.text }}>reference purposes only</strong>. Final clinical decisions remain solely the responsibility of the treating physician.
              </p>
              <p style={{ margin: 0, color: C.muted2 }}>
                The developers and copyright holders <strong style={{ color: C.muted }}>accept no liability</strong> for any medical consequences arising from the use of this software.
              </p>
            </div>
          )}
        </div>

        {/* Checkbox */}
        <button
          onClick={() => setChecked(v => !v)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left', padding: '0 0 20px', width: '100%',
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            border: `2px solid ${checked ? C.indigo : C.border2}`,
            background: checked ? C.indigo : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', marginTop: 1,
          }}>
            {checked && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span style={{ fontFamily: F.sans, fontSize: 13, color: C.secondary, lineHeight: 1.5 }}>
            {ru
              ? 'Я понимаю, что данное ПО является инструментом поддержки решений и принимаю на себя всю ответственность за клинические решения'
              : 'I understand that this software is a decision support tool and I accept full responsibility for all clinical decisions'}
          </span>
        </button>

        {/* Accept button */}
        <button
          onClick={accept}
          disabled={!checked}
          style={{
            width: '100%', padding: '16px',
            borderRadius: 16, border: 'none',
            background: checked
              ? `linear-gradient(135deg, ${C.indigo}, #6366f1)`
              : C.surface3,
            color: checked ? '#fff' : C.muted3,
            fontFamily: F.sans, fontSize: 15, fontWeight: 900,
            cursor: checked ? 'pointer' : 'default',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
          }}
        >
          {ru ? 'Принять и продолжить' : 'Accept & Continue'}
        </button>
      </div>
    </div>
  );
}
