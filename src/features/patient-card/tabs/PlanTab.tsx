import { useState } from 'react';
import { C, F } from '../../../constants/design';
import { Calendar } from '../../../ui/Calendar';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { EyeToggle } from '../../../ui/EyeToggle';
import { useTelegram } from '../../../hooks/useTelegram';
import { T } from '../../../constants/translations';
import { RefractionPlanTab } from './RefractionPlanTab';
import { CataractPlanTab } from './CataractPlanTab';

export function PlanTab() {
  const { draft, setDraft, toggleSurgicalEye } = useSessionStore();
  const { planEye, setPlanEye } = useUIStore();
  const { language } = useClinicStore();
  const { haptic } = useTelegram();
  const [showCalendar, setShowCalendar] = useState(false);
  const t = T(language);

  if (!draft) return null;

  const disabledEyes: ('od' | 'os')[] = [];
  if (draft.eye === 'OD') disabledEyes.push('os');
  if (draft.eye === 'OS') disabledEyes.push('od');

  const handleLongPressEye = (eye: 'od' | 'os') => {
    toggleSurgicalEye(eye);
    const nextEye = (useSessionStore.getState().draft?.eye || 'OU').toUpperCase();
    if (nextEye === 'OD' && planEye === 'os') setPlanEye('od');
    if (nextEye === 'OS' && planEye === 'od') setPlanEye('os');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle 
          value={planEye} 
          onChange={setPlanEye} 
          onLongPress={handleLongPressEye} 
          disabledEyes={disabledEyes} 
        />
      </div>

      {draft.type === 'cataract' ? <CataractPlanTab /> : <RefractionPlanTab />}

      <div style={{ paddingBottom: 20 }}>
        <button 
          onClick={() => { haptic.light(); setShowCalendar(!showCalendar); }} 
          style={{ 
            width: '100%', 
            background: draft.date ? `${C.green}15` : C.indigo + '10', 
            border: `1px solid ${draft.date ? C.green : C.indigo}40`, 
            borderRadius: 20, padding: '14px 16px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, 
            color: draft.date ? C.green : C.indigo, 
            fontFamily: F.sans, fontSize: 13, fontWeight: 900, cursor: 'pointer' 
          }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {draft.date ? `${t.surgery}: ${new Date(draft.date).toLocaleDateString()}` : t.scheduleSurgery}
        </button>
        {showCalendar && (
          <div style={{ marginTop: 12 }}>
            <Calendar 
              selectedDate={draft.date || null} 
              onSelect={iso => { 
                haptic.notification('success'); 
                setDraft({ date: iso, status: 'planned' }); 
                setShowCalendar(false); 
              }} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
