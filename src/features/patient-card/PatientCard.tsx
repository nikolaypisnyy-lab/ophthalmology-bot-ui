import React, { useRef, useState, useEffect } from 'react';
import { C } from '../../constants/design';
import { useSessionStore } from '../../store/useSessionStore';
import { useUIStore } from '../../store/useUIStore';
import { usePatientStore } from '../../store/usePatientStore';
import { useTelegram } from '../../hooks/useTelegram';
import { PatientHeader } from './PatientHeader';
import { BioTab } from './tabs/BioTab';
import { CalcTab } from './tabs/CalcTab';
import { PlanTab } from './tabs/PlanTab';
import { ResultTab } from './tabs/ResultTab';
import { EnhancementTab } from './tabs/EnhancementTab';
import type { PeriodKey } from '../../types/results';

if ((import.meta as any).hot) (import.meta as any).hot.decline();

export function PatientCard() {
  const { draft, closeDraft } = useSessionStore();
  const { activeTab, activeEye, closePatient, setActiveEye, setPlanEye, setResultEye } = useUIStore();
  const { savePatient } = usePatientStore();
  const { haptic } = useTelegram();
  const [isSaving, setIsSaving] = useState(false);
  const touchStartX = useRef(0);

  if (!draft) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) < 60) return;

    if (touchStartX.current < 40 && delta > 80) {
      haptic.notification('warning');
      closePatient();
      return;
    }

    haptic.selection();
    const next = delta > 0 ? 'od' : 'os';
    if (activeTab === 'bio') setActiveEye(next);
    if (activeTab === 'plan') setPlanEye(next);
    if (activeTab === 'result') setResultEye(next);
  };

  const bgGradient = activeEye === 'od'
    ? `linear-gradient(160deg, #0d0c1a 0%, ${C.bg} 100%)`
    : `linear-gradient(160deg, #091a14 0%, ${C.bg} 100%)`;

  const handleSave = async () => {
    if (isSaving || !draft) return;
    setIsSaving(true);
    try {
      const { iolResult, formulaResults, enhancementPlan, refPlan, planTweaked } = useSessionStore.getState();
      const updated = { ...draft } as any;
      
      // Ensure data structures exist
      if (!updated.od) updated.od = {};
      if (!updated.os) updated.os = {};

      if (formulaResults) updated.formulaResults = formulaResults;
      if (iolResult) updated.iolResult = iolResult;

      if (draft.type === 'refraction') {
        if (refPlan) {
          updated.savedPlan = refPlan;
          if (planTweaked) updated.planAuthor = 'surgeon';
        }
      }

      if (enhancementPlan) updated.savedEnhancement = enhancementPlan;

      // Extract results from periods
      const periodOrder: PeriodKey[] = ['1y', '6m', '3m', '1m', '1w', '1d'];
      const findEyeResult = (eye: 'od' | 'os') => {
        for (const pk of periodOrder) {
          const ed = draft.periods?.[pk]?.[eye];
          if (ed?.sph !== undefined && ed.sph !== '' && ed.sph !== null) {
            return {
              sph: parseFloat(ed.sph),
              cyl: parseFloat(ed.cyl ?? '0') || 0,
              va:  ed.va ?? '',
            };
          }
        }
        return null;
      };

      const odRes = findEyeResult('od');
      const osRes = findEyeResult('os');

      if (odRes || osRes) {
        updated.status = 'done';
        if (odRes) {
          updated.postSphOD = odRes.sph;
          updated.postCylOD = odRes.cyl;
          updated.postVaOD  = odRes.va;
        }
        if (osRes) {
          updated.postSphOS = osRes.sph;
          updated.postCylOS = osRes.cyl;
          updated.postVaOS  = osRes.va;
        }
        // General result for summary list (prioritize OD or whichever has data)
        const main = odRes || osRes;
        if (main) {
          updated.postSph = main.sph;
          updated.postCyl = main.cyl;
        }
      }

      await savePatient(updated as any);
      haptic.notification('success');
      closePatient();
      closeDraft();
    } catch (error) {
      console.error('Save failed', error);
      haptic.notification('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'absolute', inset: 0, zIndex: 1000,
        background: bgGradient,
        transition: 'background .4s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <PatientHeader onSave={handleSave} isSaving={isSaving} />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 16px 40px', WebkitOverflowScrolling: 'touch' }}>
        <div key={activeTab} className="su">
          {activeTab === 'bio'    && <BioTab />}
          {activeTab === 'calc'   && <CalcTab />}
          {activeTab === 'plan'   && <PlanTab />}
          {activeTab === 'result' && <ResultTab onSave={handleSave} isSaving={isSaving} />}
          {activeTab === 'enhancement' && <EnhancementTab />}
        </div>
      </div>
    </div>
  );
}
