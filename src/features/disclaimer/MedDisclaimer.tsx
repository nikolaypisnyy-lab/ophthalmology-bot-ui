import { C, F } from '../../constants/design';
import { useClinicStore } from '../../store/useClinicStore';

export function MedDisclaimer() {
  const { language } = useClinicStore();
  const ru = language === 'ru';

  return (
    <div style={{
      marginTop: 16,
      padding: '8px 12px',
      borderRadius: 10,
      border: `1px solid ${C.border}`,
      background: C.surface2,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted3} strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
      <span style={{ fontFamily: F.sans, fontSize: 10, color: C.muted3, lineHeight: 1.5 }}>
        {ru
          ? 'Только для поддержки клинических решений. Не является медицинским устройством. Ответственность за клинические решения несёт лечащий врач.'
          : 'For clinical decision support only. Not a medical device. The treating physician bears full responsibility for all clinical decisions.'}
      </span>
    </div>
  );
}
