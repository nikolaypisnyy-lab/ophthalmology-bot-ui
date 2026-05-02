import React, { useState, useRef, useEffect } from 'react';
import { C, F, R, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { EyeToggle, SectionLabel, AxisDial, WheelField, AutoRepeatButton } from '../../../ui';
import { useTelegram } from '../../../hooks/useTelegram';
import { LensModal } from '../LensModal';
import { calculateIOL } from '../../../api/calculate';
import { sumCylinders } from '../../../calculators/astigmatism';

// ВЫНОСИМ КОМПОНЕНТЫ НАРУЖУ

// ВЫНОСИМ КОМПОНЕНТЫ НАРУЖУ, чтобы React не пересоздавал их при каждом рендере стейта!
const getVAColor = (va?: string) => {
  const n = parseFloat(va ?? '');
  if (isNaN(n)) return C.text;
  if (n >= 0.8) return C.green;
  if (n >= 0.3) return C.amber;
  return C.red;
};

const EntryCell = ({ 
  field, label, color, val, isAx, unit, stepOverride, onStep, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef, fontSize = 24 
}: any) => {
  const step = stepOverride || (isAx ? 5 : (field.includes('sph') || field.includes('cyl') ? 0.25 : (field.includes('va') ? 0.05 : 0.1)));

  return (
    <div 
      onClick={() => onStartEdit(field, val)}
      style={{ background: C.surface, borderRadius: 14, padding: '4px 4px 6px', border: `1px solid ${C.border}`, textAlign: 'center', cursor: 'text', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 3px', borderBottom: `1px solid ${C.border}30`, marginBottom: 3 }}>
        <AutoRepeatButton onTrigger={() => onStep(field, -1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 20, padding: '12px 18px', margin: '-12px -12px', cursor: 'pointer' }}>−</AutoRepeatButton>
        <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <AutoRepeatButton onTrigger={() => onStep(field, 1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 20, padding: '12px 18px', margin: '-12px -12px', cursor: 'pointer' }}>+</AutoRepeatButton>
      </div>
      <div style={{ width: '100%', fontSize: fontSize, fontWeight: 800, color: color, fontFamily: F.mono }}>
        {isEditing ? (
          <input 
            ref={inputRef}
            value={tempValue} 
            onChange={e => onTempChange(e.target.value)} 
            onBlur={onFinish}
            onKeyDown={e => e.key === 'Enter' && onFinish()}
            inputMode="text"
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: fontSize * 0.8, fontWeight: 800, fontFamily: F.mono, outline: 'none' }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
            {(() => {
              const n = parseFloat(String(val));
              if (isNaN(n)) return '—';
              if (isAx) return Math.round(n).toString();
              if (n > 25) return n.toFixed(2); 
              // No plus for visual acuity, axis, bio fields, or SIA
              const showPlus = !isAx && !field.includes('va') && !field.includes('k') && !field.includes('bio') && field !== 'sia' && n >= 0;
              return (showPlus ? '+' : '') + n.toFixed(2);
            })()}
            {unit && (
              <span style={{ 
                fontSize: unit === '°' ? 12 : 8, 
                color: C.muted3, 
                fontWeight: 700, 
                marginLeft: 1,
                alignSelf: unit === '°' ? 'flex-start' : 'baseline',
                marginTop: unit === '°' ? 2 : 0
              }}>
                {unit}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const DiagnosticCell = ({ 
  field, color, val, isAx, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef, fontSize = 13 
}: any) => {
  return (
    <div 
      onClick={() => onStartEdit(field, val)}
      style={{ 
        textAlign: 'center', fontSize: fontSize, fontFamily: F.mono, fontWeight: 800, color: color, 
        cursor: 'text', minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' 
      }}
    >
      {isEditing ? (
        <input 
          ref={inputRef} value={tempValue} onChange={e => onTempChange(e.target.value)} 
          onBlur={onFinish} onKeyDown={e => e.key === 'Enter' && onFinish()} inputMode="text"
          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: fontSize, fontWeight: 800, fontFamily: F.mono, outline: 'none', padding: 0 }} 
        />
      ) : (
        <>
          {(() => {
            const n = parseFloat(String(val));
            if (isNaN(n)) return '—';
            const isK = field.includes('k') && !isAx;
            if (isAx) return Math.round(n).toString() + '°';
            if (isK) return n.toFixed(2);
            if (n > 25) return n.toFixed(0); 
            const showPlus = !field.includes('va') && !isK && n >= 0;
            return (showPlus ? '+' : '') + n.toFixed(2);
          })()}
        </>
      )}
    </div>
  );
};

const CompactInput = ({ 
  field, color, val, isAx, isK, label, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef, onStep, fontSize = 12 
}: any) => {
  const step = isAx ? 5 : (field.includes('va') ? 0.05 : 0.25);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {label && <div style={{ fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: `${C.surface}80`, borderRadius: 10, padding: '2px 4px', border: `1px solid ${isEditing ? color : C.border}60`, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <AutoRepeatButton onTrigger={() => onStep(field, -1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 16, padding: '10px 14px', margin: '-10px -8px', cursor: 'pointer' }}>−</AutoRepeatButton>
        <div onClick={() => onStartEdit(field, val)} style={{ flex: 1, textAlign: 'center', fontSize: fontSize, fontFamily: F.mono, fontWeight: 800, color: color, cursor: 'text' }}>
          {isEditing ? (
            <input ref={inputRef} value={tempValue} onChange={e => onTempChange(e.target.value)} onBlur={onFinish} onKeyDown={e => e.key === 'Enter' && onFinish()} inputMode="text"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: fontSize, fontWeight: 800, fontFamily: F.mono, outline: 'none', padding: 0 }} />
          ) : (
            <>
              {(() => {
                const n = parseFloat(String(val));
                if (isNaN(n)) return '—';
                if (isAx) return Math.round(n).toString();
                if (n > 25) return n.toFixed(2); 
                const showPlus = !field.includes('va') && !field.includes('k') && n >= 0;
                return (showPlus ? '+' : '') + n.toFixed(2);
              })()}
              {isAx && !isNaN(parseFloat(String(val))) && ''}
            </>
          )}
        </div>
        <AutoRepeatButton onTrigger={() => onStep(field, 1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 16, padding: '10px 14px', margin: '-10px -8px', cursor: 'pointer' }}>+</AutoRepeatButton>
      </div>
    </div>
  );
};

// CompactInput Component

export function BioTab() {
  const { 
    draft, setDraft, iolResult, setIOLResult, setEyeField, setBioField, toggleSurgicalEye,
    formulaResults, setFormulaResults, iolLoading: isCalculating, setIOLLoading: setIsCalculating,
    iolError: calcError, setIOLError: setCalcError, toricResults, setToricResults
  } = useSessionStore();
  const { activeEye, setActiveEye, editingField, setEditingField, tempValue, setTempValue } = useUIStore();
  const { haptic } = useTelegram();
  const [isLensModalOpen, setIsLensModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastCalc, setLastCalc] = useState<string | null>(null);
  const [pMode, setPMode] = useState<'ANT' | 'POST' | 'TOTAL'>('TOTAL');

  // --- ВЕКТОРНЫЙ СУММАРНЫЙ АСТИГМАТИЗМ (PENTACAM) ---
  useEffect(() => {
    if (!draft || !draft[activeEye]) return;
    const eye = draft[activeEye] as any;
    
    // Считаем Total автоматически из ANT и POST
    const ac = parseFloat(eye.p_ant_c || '0');
    const aa = parseFloat(eye.p_ant_a || '0');
    const pc = parseFloat(eye.p_post_c || '0');
    const pa = parseFloat(eye.p_post_a || '0');
    
    if (ac !== 0 || pc !== 0) {
      // ПРИМЕЧАНИЕ: Передняя поверхность — собирающая (плюс-цилиндр), 
      // Задняя — рассеивающая (минус-цилиндр).
      // Результат в минусовой нотации (ось слабого меридиана).
      const res = sumCylinders(Math.abs(ac), aa, -Math.abs(pc), pa);
      
      const tc = (res.cyl > 0 ? '+' : '') + res.cyl.toFixed(2);
      const ta = res.ax.toString();
      
      // Автоматический Km (среднее K1/K2)
      const k1 = parseFloat(eye.k1 || '0');
      const k2 = parseFloat(eye.k2 || '0');
      const km = (k1 && k2) ? ((k1 + k2) / 2).toFixed(2) : '';

      // Обновляем только если значения реально изменились и мы НЕ в режиме редактирования полей TOTAL
      const isEditingTotal = editingField === 'p_tot_c' || editingField === 'p_tot_a' || editingField === 'p_tot_k';
      if (!isEditingTotal) {
        if (eye.p_tot_c !== tc || eye.p_tot_a !== ta) {
          setEyeField(activeEye, 'p_tot_c', tc);
          setEyeField(activeEye, 'p_tot_a', ta);
        }
        if (km && !eye.p_tot_k) {
          setEyeField(activeEye, 'p_tot_k', km);
        }
      }
    }
  }, [
    draft[activeEye]?.p_ant_c, draft[activeEye]?.p_ant_a, 
    draft[activeEye]?.p_post_c, draft[activeEye]?.p_post_a,
    draft[activeEye]?.k1, draft[activeEye]?.k2,
    activeEye, editingField
  ]);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const activeEyeRef = useRef(activeEye);
  useEffect(() => {
    if (activeEye !== activeEyeRef.current) {
      if (editingField) {
        // Save the currently edited field to the previous eye before switching
        setEyeField(activeEyeRef.current, editingField as any, tempValue);
        setEditingField(null);
      }
      activeEyeRef.current = activeEye;
    }
  }, [activeEye, editingField, tempValue, setEyeField]);

  if (!draft) return null;
  const data = draft[activeEye] || {};
  const ec = eyeColors(activeEye);

  const set = (f: string, v: string) => setEyeField(activeEye, f as any, v);

  const handleStartEdit = (field: string, val: any) => {
    setTempValue(String(val || ''));
    setEditingField(field);
  };

  const handleFinishEdit = () => {
    if (editingField) {
      set(editingField, tempValue);
    }
    setEditingField(null);
  };

  const handleStep = (field: string, dir: number, step: number) => {
    // Get latest data from store to avoid stale closure in setInterval
    const latestDraft = useSessionStore.getState().draft;
    if (!latestDraft) return;
    const latestEye = latestDraft[activeEye] || {};
    
    const val = (latestEye as any)[field];
    
    // Default 400 for CCT if empty
    let cur = parseFloat(val);
    if (isNaN(cur)) {
      if (field === 'cct') cur = 400;
      else cur = (field.includes('k') && !field.includes('ax') ? 43 : 0);
    }
    
    let n = cur + (dir * step);
    if (field === 'cct') n = Math.max(0, n);
    const isAx = field.includes('ax') || field.endsWith('_a');
    
    // Pentacam notation logic
    const isPentaCyl = field.startsWith('p_') && field.endsWith('_c');
    if (isPentaCyl) {
      if (field.includes('tot')) {
        if (n > 0) n = -n; // Total is always minus
      } else {
        if (n < 0) n = Math.abs(n); // ANT/POST are always plus
      }
    }

    if (isAx) {
      if (n < 0) n = 180 + n;
      if (n >= 180) n = n - 180;
    }
    const nv = n.toFixed(isAx ? 0 : 2);
    const showPlus = !isAx && !field.includes('va') && !field.includes('k') && !field.includes('bio') && field !== 'sia' && field !== 'cct' && !field.includes('p_tot') && n >= 0;
    set(field, (isAx || field === 'cct') ? n.toFixed(0) : (n > 25 ? nv : (showPlus ? '+' : '') + nv));
    haptic.light();
  };



  const runRealCalculation = async (formula: string) => {
    if (!draft) return;
    const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
    
    // ПРОВЕРКА ДАННЫХ
    if (!bio.al || !bio.k1 || !bio.k2) {
      setCalcError("MISSING AL/K1/K2");
      return;
    }

    console.log('[CALC] Triggering:', formula);
    setCalcError(null);
    setIsCalculating(true);
    const latest = useSessionStore.getState();
    const latestIOL = latest.iolResult;
    const latestTarget = latest.draft?.targetRefr;

    try {
      const res = await calculateIOL({
        active_eye: activeEye,
        al: parseFloat(bio.al || '0'),
        acd: parseFloat(bio.acd || '0'),
        lt: parseFloat(bio.lt || '0'),
        wtw: parseFloat(bio.wtw || '0'),
        k1: parseFloat(bio.k1 || '0'),
        k2: parseFloat(bio.k2 || '0'),
        k1_ax: parseFloat(bio.k1_ax || '0'),
        lens: latestIOL?.lens || 'AcrySof IQ',
        a_const: latestIOL?.aConst || 119.3,
        formula: formula,
        target_refr: parseFloat(latestTarget || '0'),
        toricMode: draft.toricMode,
        sia: parseFloat(draft.sia || '0.1'),
        incAx: parseFloat(draft.incAx || '90'),
      } as any);

      console.log('[CALC] Response Payload:', res);

      // Backend returns 'results' instead of 'data'
      const rawResults = res.results || res.data;

      if (res.status === 'ok' && rawResults) {
        // If results is a list, just map it to the active formula. 
        // If it's a map (Haigis/Barrett/Kane), ingest EVERYTHING.
        const updatedFormulaMap = Array.isArray(rawResults) 
          ? { ...(formulaResults[activeEye] || {}), [formula]: rawResults }
          : { ...(formulaResults[activeEye] || {}), ...rawResults };
        
        const newResults = {
          ...formulaResults,
          [activeEye]: updatedFormulaMap
        };
        setFormulaResults(newResults);
        setLastCalc(new Date().toLocaleTimeString());

        if (res.toric) {
          setToricResults({
            ...toricResults,
            [activeEye]: res.toric
          });
        }

        const currentResults = Array.isArray(rawResults) ? rawResults : (rawResults[formula] || []);
        
        // Получаем актуальный iolResult из стора
        const st = useSessionStore.getState();
        const latestIOL = st.iolResult;
        const currentLens = latestIOL?.lens || st.draft?.iolResult?.lens || 'AcrySof IQ';
        const currentA = latestIOL?.aConst || st.draft?.iolResult?.aConst || 119.3;

        if (!latestIOL?.power || latestIOL.power === '—') {
          const emmetropia = currentResults.find((r: any) => r.is_emmetropia);
          if (emmetropia) {
            const eyeRes = (latestIOL as any)?.[activeEye] || {};
            st.setIOLResult({ 
              ...(latestIOL || { 
                lens: currentLens, 
                aConst: currentA, 
                targetRefr: parseFloat(draft.targetRefr || '0'), 
                timestamp: new Date().toISOString(), 
                source: 'api' 
              }), 
              power: (emmetropia.power > 0 ? '+' : '') + emmetropia.power.toFixed(2),
              [activeEye]: { 
                ...eyeRes, 
                selectedPower: emmetropia.power, 
                expectedRefr: emmetropia.refraction ?? emmetropia.ref ?? 0 
              }
            } as any);
          }
        }
      } else {
        const err = res.detail || 'Calculation Error';
        setCalcError(err);
        console.error('[CALC] Error Detail:', err);
      }
    } catch (e: any) {
      setCalcError('Connection Failed');
      console.error('[CALC] Exception:', e);
    } finally {
      setIsCalculating(false);
    }
  };

  const disabledEyes: ('od' | 'os')[] = [];
  const currentEye = (draft.eye || 'OU').toUpperCase();
  if (currentEye === 'OD') disabledEyes.push('os');
  if (currentEye === 'OS') disabledEyes.push('od');

  const handleLongPressEye = (eye: 'od' | 'os') => {
    toggleSurgicalEye(eye);
    const nextEye = (useSessionStore.getState().draft?.eye || 'OU').toUpperCase();
    if (nextEye === 'OD' && activeEye === 'os') setActiveEye('od');
    if (nextEye === 'OS' && activeEye === 'od') setActiveEye('os');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
        <EyeToggle value={activeEye} onChange={setActiveEye} disabledEyes={disabledEyes} onLongPress={handleLongPressEye} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 4px 4px' }}>
        <SectionLabel color={C.secondary || C.muted2} style={{ margin: 0, fontSize: 10, letterSpacing: '0.14em', fontWeight: 700 }}>
          {draft.type === 'cataract' ? 'BIOMETRY' : 'DIAGNOSTICS'}
        </SectionLabel>
      </div>
      
      {draft.type === 'cataract' ? (
        <div style={{ background: C.card, borderRadius: 24, padding: '12px 14px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 4px' }}>
            {/* COLUMN 1: AL & ACD */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'AL', field: 'al', unit: 'mm', color: activeEye === 'os' ? C.os : C.od, step: 0.01 },
                { label: 'ACD', field: 'acd', unit: 'mm', color: activeEye === 'os' ? C.os : C.od, step: 0.01 },
              ].map(f => {
                const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
                return (
                  <EntryCell 
                    key={f.label}
                    field={`bio_${f.field}`}
                    label={f.label}
                    unit={f.unit}
                    color={f.color}
                    val={bio[f.field]}
                    stepOverride={f.step}
                    onStep={(field: string, dir: number, step: number) => {
                      const latestDraft = useSessionStore.getState().draft as any;
                      const b = latestDraft[`bio_${activeEye}`] || {};
                      const cur = parseFloat(b[f.field] || '0');
                      setBioField(activeEye, f.field, (cur + dir * step).toFixed(2));
                      haptic.light();
                    }}
                    onStartEdit={handleStartEdit}
                    isEditing={editingField === `bio_${f.field}`}
                    tempValue={tempValue}
                    onTempChange={setTempValue}
                    onFinish={() => {
                      setBioField(activeEye, f.field, tempValue);
                      setEditingField(null);
                    }}
                    inputRef={inputRef}
                  />
                );
              })}
            </div>

            {/* COLUMN 2: LT* & WTW* */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'LT*', field: 'lt', unit: 'mm', color: activeEye === 'os' ? C.os : C.od, step: 0.01 },
                { label: 'WTW*', field: 'wtw', unit: 'mm', color: activeEye === 'os' ? C.os : C.od, step: 0.1 },
              ].map(f => {
                const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
                return (
                  <EntryCell 
                    key={f.label}
                    field={`bio_${f.field}`}
                    label={f.label}
                    unit={f.unit}
                    color={f.color}
                    val={bio[f.field]}
                    stepOverride={f.step}
                    onStep={(field: string, dir: number, step: number) => {
                      const latestDraft = useSessionStore.getState().draft as any;
                      const b = latestDraft[`bio_${activeEye}`] || {};
                      const cur = parseFloat(b[f.field] || '0');
                      setBioField(activeEye, f.field, (cur + dir * step).toFixed(2));
                      haptic.light();
                    }}
                    onStartEdit={handleStartEdit}
                    isEditing={editingField === `bio_${f.field}`}
                    tempValue={tempValue}
                    onTempChange={setTempValue}
                    onFinish={() => {
                      setBioField(activeEye, f.field, tempValue);
                      setEditingField(null);
                    }}
                    inputRef={inputRef}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}30`, paddingTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 4px' }}>
              {/* KERAT: K1 & K2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'K1', field: 'k1', color: C.amber, step: 0.25 },
                  { label: 'K2', field: 'k2', color: C.amber, step: 0.25 },
                ].map(f => {
                  const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
                  return (
                    <EntryCell 
                      key={f.label}
                      field={`bio_${f.field}`}
                      label={f.label}
                      color={f.color}
                      val={bio[f.field]}
                      stepOverride={f.step}
                      fontSize={18}
                      onStep={(field: string, dir: number, step: number) => {
                        const latestDraft = useSessionStore.getState().draft as any;
                        const b = latestDraft[`bio_${activeEye}`] || {};
                        const cur = parseFloat(b[f.field] || (field.includes('k') ? '43' : '0'));
                        setBioField(activeEye, f.field, (cur + dir * step).toFixed(2));
                        haptic.light();
                      }}
                      onStartEdit={handleStartEdit}
                      isEditing={editingField === `bio_${f.field}`}
                      tempValue={tempValue}
                      onTempChange={setTempValue}
                      onFinish={() => {
                        setBioField(activeEye, f.field, tempValue);
                        setEditingField(null);
                      }}
                      inputRef={inputRef}
                    />
                  );
                })}
              </div>

              {/* KERAT: AX1 & AX2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'AXIS K1', field: 'k1_ax', color: C.amber, step: 5, isAx: true },
                  { label: 'AXIS K2', field: 'k2_ax', color: C.amber, step: 5, isAx: true },
                ].map(f => {
                  const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
                  let val = bio[f.field];
                  
                  // Fallback for K2 Axis if it's missing but K1 Axis is present
                  if (f.field === 'k2_ax' && !val && bio.k1_ax) {
                    const v = parseFloat(bio.k1_ax);
                    if (!isNaN(v)) {
                      let opp = v + 90;
                      if (opp >= 180) opp -= 180;
                      val = opp.toString();
                    }
                  }

                  const isRO = false;
                  return (
                    <EntryCell 
                      key={f.label}
                      field={`bio_${f.field}`}
                      label={f.label}
                      color={isRO ? C.muted3 : f.color}
                      val={val}
                      isAx={f.isAx}
                      stepOverride={f.step}
                      fontSize={18}
                      onStep={(field: string, dir: number, step: number) => {
                        const latestDraft = useSessionStore.getState().draft as any;
                        const b = latestDraft[`bio_${activeEye}`] || {};
                        const cur = parseFloat(b[f.field] || '0');
                        setBioField(activeEye, f.field, (cur + dir * step).toString());
                        haptic.light();
                      }}
                      onStartEdit={handleStartEdit}
                      isEditing={editingField === `bio_${f.field}`}
                      tempValue={tempValue}
                      onTempChange={setTempValue}
                      onFinish={() => {
                        setBioField(activeEye, f.field, tempValue);
                        setEditingField(null);
                      }}
                      inputRef={inputRef}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ 
                  fontFamily: F.mono, fontSize: 9, fontWeight: 600, color: C.indigo, 
                  letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4, opacity: 0.8 
                }}>
                  Lens Model
                </label>
                <div 
                  onClick={() => { haptic.success(); setIsLensModalOpen(true); }} 
                  style={{ 
                    background: C.surface, borderRadius: 12, padding: '10px 14px', 
                    border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', 
                    justifyContent: 'space-between', cursor: 'pointer', height: 40, boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{draft.iolResult?.lens || 'Select Lens...'}</span>
                  <div style={{ background: `${C.indigo}20`, borderRadius: 8, padding: '4px 10px', color: C.indigo, fontSize: 9, fontWeight: 900 }}>
                    CHOOSE
                  </div>
                </div>
              </div>
              
              <div style={{ width: 100 }}>
                <WheelField
                  label="Target"
                  value={draft.targetRefr || '0.00'}
                  onChange={(v) => setDraft({ targetRefr: v })}
                  min={-3}
                  max={3}
                  step={0.25}
                  unit="D"
                  accentColor={C.green}
                  accentText
                  fw={800}
                />
              </div>
            </div>

            {/* Formula picker + CALC button */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <div style={{
                flex: 1, display: 'flex', gap: 4, background: C.surface, padding: 2, borderRadius: 10,
                border: `1px solid ${C.border}`,
              }}>
                {(['Haigis', 'Barrett', 'Kane'] as const).map(f => (
                  <div
                    key={f}
                    onClick={(e) => { e.stopPropagation(); haptic.light(); setDraft({ activeFormula: f }); }}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, textAlign: 'center',
                      background: draft.activeFormula === f ? `${C.indigo}15` : 'transparent',
                      color: draft.activeFormula === f ? C.indigo : C.muted2,
                      fontSize: 9, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s',
                    }}
                  >{f}</div>
                ))}
              </div>

              <button
                onClick={() => { haptic.success(); runRealCalculation(draft.activeFormula || 'Barrett'); }}
                disabled={isCalculating}
                style={{
                  padding: '0 20px', borderRadius: 24, border: 'none',
                  background: isCalculating ? C.surface : `linear-gradient(135deg, ${C.indigo}, #3b82f6)`,
                  color: isCalculating ? C.muted3 : '#fff',
                  fontSize: 10, fontWeight: 900, fontFamily: F.sans,
                  letterSpacing: '0.06em', cursor: isCalculating ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  boxShadow: isCalculating ? 'none' : '0 4px 14px rgba(129,140,248,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {isCalculating ? (
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    border: `2px solid ${C.muted3}`, borderTopColor: C.indigo,
                    animation: 'spin 0.7s linear infinite',
                  }} />
                ) : (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {isCalculating ? '...' : 'CALC'}
              </button>
            </div>

            {/* TORIC SWITCH */}
            {(() => {
              const k1 = parseFloat(data.k1 || '0');
              const k2 = parseFloat(data.k2 || '0');
              const cyl = Math.abs(k1 - k2);
              const isSignificant = cyl >= 1.0;
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div 
                    onClick={() => { haptic.success(); setDraft({ toricMode: !draft.toricMode }); }}
                    style={{ 
                      marginTop: 4, padding: '10px 12px', background: draft.toricMode ? `${C.indigo}10` : C.surface, 
                      borderRadius: 16, border: `1px solid ${draft.toricMode ? `${C.indigo}40` : C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: C.text, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Toric Calculator</span>
                      {draft.toricMode && toricResults?.[activeEye] ? (
                        <span style={{ fontSize: 8, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Recommended: {toricResults[activeEye].best_model} @ {toricResults[activeEye].total_steep_axis}°
                        </span>
                      ) : isSignificant && !draft.toricMode && (
                        <span style={{ fontSize: 7, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Suggested (Cyl {cyl.toFixed(2)}D)
                        </span>
                      )}
                    </div>
                    <div style={{ 
                      width: 36, height: 20, borderRadius: 10, background: draft.toricMode ? C.indigo : C.border, 
                      position: 'relative', transition: 'background 0.2s' 
                    }}>
                      <div style={{ 
                        position: 'absolute', top: 2, left: draft.toricMode ? 18 : 2, width: 16, height: 16, 
                        borderRadius: 8, background: '#fff', transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>

                  {draft.toricMode && (
                    <div style={{ display: 'flex', gap: 10, padding: '0 2px' }}>
                      <div style={{ flex: 1 }}>
                        <EntryCell 
                          field="sia" 
                          label="SIA" 
                          color={C.indigo} 
                          val={draft.sia || '0.10'} 
                          unit="D"
                          stepOverride={0.05}
                          onStep={(f: string, dir: number, step: number) => {
                            const st = useSessionStore.getState();
                            const cur = parseFloat(st.draft?.sia || '0.10');
                            const next = Math.max(0, cur + dir * step);
                            st.setDraft({ sia: next.toFixed(2) });
                            haptic.light();
                          }}
                          onStartEdit={handleStartEdit}
                          isEditing={editingField === 'sia'}
                          tempValue={tempValue}
                          onTempChange={setTempValue}
                          onFinish={() => {
                            setDraft({ sia: tempValue });
                            setEditingField(null);
                          }}
                          inputRef={inputRef}
                          fontSize={18}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <EntryCell 
                          field="incAx" 
                          label="INCISION" 
                          color={C.indigo} 
                          val={draft.incAx || '90'} 
                          unit="°"
                          isAx
                          stepOverride={5}
                          onStep={(f: string, dir: number, step: number) => {
                            const st = useSessionStore.getState();
                            const cur = parseFloat(st.draft?.incAx || '90');
                            st.setDraft({ incAx: (cur + dir * step).toString() });
                            haptic.light();
                          }}
                          onStartEdit={handleStartEdit}
                          isEditing={editingField === 'incAx'}
                          tempValue={tempValue}
                          onTempChange={setTempValue}
                          onFinish={() => {
                            setDraft({ incAx: tempValue });
                            setEditingField(null);
                          }}
                          inputRef={inputRef}
                          fontSize={18}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {calcError && (
              <div style={{ padding: '8px 12px', background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 10, color: C.red, fontSize: 8, fontWeight: 900, textAlign: 'center', letterSpacing: '0.04em' }}>
                {calcError.toUpperCase()}
              </div>
            )}

            {isCalculating && (
              <div style={{ padding: '0 4px' }}>
                <div style={{ height: 2, width: '100%', background: `${C.indigo}10`, borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', height: '100%', width: '40%', background: C.indigo, boxShadow: `0 0 10px ${C.indigo}`, animation: 'calculateProgress 1.2s infinite linear' }} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 7, fontWeight: 900, color: C.indigo, letterSpacing: '0.1em', marginTop: 6 }}>
                  CALCULATING {(draft.activeFormula || 'Barrett').toUpperCase()}...
                </div>
              </div>
            )}

            {lastCalc && !isCalculating && !calcError && (
              <div style={{ textAlign: 'center', fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ✓ Updated {lastCalc}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: C.card, borderRadius: 24, padding: '16px 14px 12px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '0 2px' }}>
            <div style={{ flex: 1, background: C.surface, borderRadius: 12, padding: '6px 10px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>UCVA</span>
              <CompactInput field="uva" color={getVAColor(data.uva)} val={data.uva} onStartEdit={handleStartEdit} isEditing={editingField === 'uva'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} fontSize={15} />
            </div>
            <div style={{ flex: 1, background: C.surface, borderRadius: 12, padding: '6px 10px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>BCVA</span>
              <CompactInput field="bcva" color={getVAColor(data.bcva)} val={data.bcva} onStartEdit={handleStartEdit} isEditing={editingField === 'bcva'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} fontSize={15} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr 64px', columnGap: 6, rowGap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: ec.color, textAlign: 'center', borderRight: `1px solid ${C.border}20`, paddingRight: 4 }}>M</div>

            <EntryCell field="man_sph" label="SPH" color={ec.color} val={data.man_sph} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="man_cyl" label="CYL" color={ec.color} val={data.man_cyl} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="man_ax" label="AX" color={ec.color} val={data.man_ax} isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            
            <div style={{ gridColumn: 5, gridRow: '1 / 5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4, gap: 4, marginTop: -10 }}>
              <div style={{ textAlign: 'center', lineHeight: 1 }}>
                <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Astigmatism</div>
                <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Axis</div>
              </div>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${C.surface}80`, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <AxisDial 
                  axis={parseInt(data.man_ax || '0')} 
                  kAxis={parseInt(data.k_ax || '0')} 
                  pAxis={parseInt(data.p_tot_a || '0')} 
                  size={56} color={ec.color} tickWidth={2} 
                />
              </div>

              {(() => {
                const kAx = parseInt(data.p_tot_a || data.k_ax || '0');
                const k1 = parseFloat(data.k1 || '0');
                const k2 = parseFloat(data.k2 || '0');
                const cylVal = data.p_tot_c ? parseFloat(data.p_tot_c) : (k1 && k2 ? Math.abs(k1 - k2) : 0);
                
                // Classification based on STEEP meridian (90 deg from minus-cyl axis)
                const steep = (kAx + 90) % 180;
                let type = 'Oblique';
                if ((steep >= 0 && steep <= 30) || (steep >= 150 && steep <= 180)) type = 'ATR';
                else if (steep >= 60 && steep <= 120) type = 'WTR';

                return (
                  <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: C.text, textTransform: 'uppercase', marginBottom: 2 }}>{type}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: C.amber, fontFamily: F.mono }}>{cylVal.toFixed(2)}D</div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: C.muted2, fontFamily: F.mono, opacity: 0.8 }}>ax {steep}°</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, color: C.amber, textAlign: 'center', borderRight: `1px solid ${C.border}20`, paddingRight: 4 }}>K</div>
            <DiagnosticCell field="k1" color={C.amber} val={data.k1} onStartEdit={handleStartEdit} isEditing={editingField === 'k1'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <DiagnosticCell field="k2" color={C.amber} val={data.k2} onStartEdit={handleStartEdit} isEditing={editingField === 'k2'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <DiagnosticCell field="k_ax" color={C.amber} val={data.k_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'k_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />

            <div style={{ fontSize: 16, fontWeight: 900, color: C.indigo, textAlign: 'center', borderRight: `1px solid ${C.border}20`, paddingRight: 4 }}>N</div>
            <DiagnosticCell field="n_sph" color={C.indigo} val={data.n_sph} onStartEdit={handleStartEdit} isEditing={editingField === 'n_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <DiagnosticCell field="n_cyl" color={C.indigo} val={data.n_cyl} onStartEdit={handleStartEdit} isEditing={editingField === 'n_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <DiagnosticCell field="n_ax" color={C.indigo} val={data.n_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'n_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />

            <div style={{ fontSize: 16, fontWeight: 900, color: C.muted2, textAlign: 'center', borderRight: `1px solid ${C.border}20`, paddingRight: 4 }}>W</div>
            <DiagnosticCell field="c_sph" color={C.muted2} val={data.c_sph} onStartEdit={handleStartEdit} isEditing={editingField === 'c_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <DiagnosticCell field="c_cyl" color={C.muted2} val={data.c_cyl} onStartEdit={handleStartEdit} isEditing={editingField === 'c_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <DiagnosticCell field="c_ax" color={C.muted2} val={data.c_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'c_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
          </div>
        </div>
      )}

      {draft.type === 'refraction' && (
        <>
          <SectionLabel color={C.secondary || C.muted2} style={{ margin: '8px 0 4px 4px', fontSize: 10, letterSpacing: '0.14em', fontWeight: 700 }}>ASTIGMATISM · PENTACAM</SectionLabel>
          <div style={{ background: C.card, borderRadius: 24, padding: '10px 12px 8px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 10, color: C.indigo, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pentacam Station</span>
              <div style={{ display: 'flex', background: C.surface, borderRadius: 10, padding: 2, border: `1px solid ${C.border}` }}>
                {(['ANT', 'POST', 'TOTAL'] as const).map(m => (
                  <button key={m} onClick={() => setPMode(m)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: pMode === m ? C.cardHi : 'transparent', color: pMode === m ? C.text : C.muted2, fontFamily: F.sans, fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: pMode === 'TOTAL' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', 
              gap: 6, alignItems: 'center', marginBottom: 10 
            }}>
              {(() => {
                const prefix = pMode === 'ANT' ? 'p_ant' : pMode === 'POST' ? 'p_post' : 'p_tot';
                const fK = `${prefix}_k`;
                const fC = `${prefix}_c`;
                const fA = `${prefix}_a`;
                
                return (
                  <>
                    {pMode === 'TOTAL' && (
                      <EntryCell 
                        field={fK} label="TOTAL KM" color={C.indigo} val={data[fK]} stepOverride={0.1} 
                        onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === fK} 
                        tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} 
                      />
                    )}
                    <EntryCell 
                      field={fC} label={`${pMode}-CYL`} color={C.indigo} val={data[fC]} 
                      onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === fC} 
                      tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} 
                    />
                    <EntryCell 
                      field={fA} label={`${pMode}-AX`} color={C.indigo} val={data[fA]} isAx 
                      onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === fA} 
                      tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} 
                    />
                  </>
                );
              })()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, alignItems: 'center' }}>
              <EntryCell 
                field="cct" label="PACHY (CCT)" color={C.amber} val={data.cct} stepOverride={10} fontSize={22}
                onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'cct'} 
                tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} 
              />
            </div>
          </div>

        </>
      )}

      {isLensModalOpen && (
        <LensModal isOpen={isLensModalOpen} onClose={() => setIsLensModalOpen(false)} />
      )}
    </div>
  );
}
