import React, { useRef } from 'react';
import { C } from '../../constants/design';

// Запретить HMR для этого файла — любое изменение вызывает полный перезапуск страницы
if ((import.meta as any).hot) (import.meta as any).hot.decline();
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

export function PatientCard() {
  const { draft, closeDraft } = useSessionStore();
  const { activeTab, activeEye, closePatient, setActiveEye, setPlanEye, setResultEye } = useUIStore();
  const { savePatient } = usePatientStore();
  const { haptic } = useTelegram();
  const [isSaving, setIsSaving] = React.useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  if (!draft) return null;
  


  // Свайп логика
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const delta = endX - touchStartX.current;
    const absDelta = Math.abs(delta);

    if (absDelta < 60) return;

    // 1. Edge Swipe to Close (Свайп от левого края вправо)
    if (touchStartX.current < 30 && delta > 80) {
      haptic.medium(); // Feedback on close
      closePatient();
      return;
    }

    // 2. Switching Eyes (Свайп в середине экрана)
    // Влево (delta < 0) -> OS
    // Вправо (delta > 0) -> OD
    haptic.light();
    const next = delta > 0 ? 'od' : 'os';
    
    if (activeTab === 'bio') setActiveEye(next);
    if (activeTab === 'plan') setPlanEye(next);
    if (activeTab === 'result') setResultEye(next);
  };

  // Solid Ocular Background (Non-transparent)
  const bgGradient = activeEye === 'od'
    ? `linear-gradient(160deg, #0a0d1a 0%, ${C.bg} 100%)`
    : `linear-gradient(160deg, #091a14 0%, ${C.bg} 100%)`;

  const handleSave = async () => {
    if (isSaving || !draft) return;
    setIsSaving(true);
    try {
      // Собираем финальные данные
      const { 
        iolResult, 
        formulaResults,
        enhancementPlan, 
        refPlan, 
        planTweaked 
      } = useSessionStore.getState();

      const updated = { ...draft } as any;
      if (!updated.od) updated.od = {};
      if (!updated.os) updated.os = {};
      
      // Забираем стратегии из черновика, который редактировался в PlanTab
      updated.od.astigStrategy = draft.od?.astigStrategy;
      updated.os.astigStrategy = draft.os?.astigStrategy;

      if (formulaResults) {
        updated.formulaResults = formulaResults;
      }

      // Сохраняем результаты ИОЛ (если есть)
      if (iolResult) {
        updated.iolResult = iolResult;
      }

      // Если план ЛКЗ — сохраняем savedPlan
      if (draft.type === 'refraction' && refPlan) {
        updated.savedPlan = refPlan;
        if (planTweaked) updated.planAuthor = 'surgeon';
      }

      // Если есть план докоррекции — сохраняем его
      if (enhancementPlan) {
        updated.savedEnhancement = enhancementPlan;
      }

      // Вычисляем postSph/Va из последнего заполненного периода — отдельно по каждому глазу
      const periodOrder: PeriodKey[] = ['1y', '6m', '3m', '1m', '1w', '1d'];

      const findEyeResult = (eye: 'od' | 'os') => {
        for (const pk of periodOrder) {
          const ed = draft.periods?.[pk]?.[eye];
          if (ed?.sph !== undefined && ed.sph !== '') {
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
      const anyRes = odRes ?? osRes;

      if (anyRes) {
        updated.status  = 'done';
        updated.postSph = anyRes.sph;
        updated.postCyl = anyRes.cyl;
      }
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

      await savePatient(updated as any);
      haptic.success();
      closePatient();
      closeDraft();
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
        transition: 'background .4s ease',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <PatientHeader onSave={handleSave} isSaving={isSaving} />

      <div
        ref={bodyRef}
        style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 32px' }}
      >
        {activeTab === 'bio'    && <BioTab />}
        {activeTab === 'calc'   && <CalcTab />}
        {activeTab === 'plan'   && <PlanTab />}
        {activeTab === 'result' && <ResultTab onSave={handleSave} isSaving={isSaving} />}
        {activeTab === 'enhancement' && <EnhancementTab />}
      </div>
    </div>
  );
}
