import React, { useState, useRef, useEffect } from 'react';
import { C, F, R, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { EyeToggle, SectionLabel, AxisDial, WheelField } from '../../../ui';
import { useTelegram } from '../../../hooks/useTelegram';
import { LensModal } from '../LensModal';
import { calculateIOL } from '../../../api/calculate';
import { sumCylinders } from '../../../calculators/astigmatism';

// ВЫНОСИМ КОМПОНЕНТЫ НАРУЖУ, чтобы React не пересоздавал их при каждом рендере стейта!
const EntryCell = ({ 
  field, label, color, val, isAx, unit, stepOverride, onStep, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef 
}: any) => {
  const step = stepOverride || (isAx ? 5 : (field.includes('sph') || field.includes('cyl') ? 0.25 : (field.includes('va') ? 0.05 : 0.1)));

  return (
    <div 
      onClick={() => onStartEdit(field, val)}
      style={{ background: C.surface, borderRadius: 12, padding: '6px 4px 8px', border: `1px solid ${C.border}`, textAlign: 'center', cursor: 'text' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 4px', borderBottom: `1px solid ${C.border}40`, marginBottom: 6 }}>
        <button onClick={(e) => { e.stopPropagation(); onStep(field, -1, step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 12, padding: '0 2px', cursor: 'pointer' }}>−</button>
        <div style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>{label}</div>
        <button onClick={(e) => { e.stopPropagation(); onStep(field, 1, step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 12, padding: '0 2px', cursor: 'pointer' }}>+</button>
      </div>
      <div style={{ width: '100%', fontSize: 20, fontWeight: 800, color: color, fontFamily: F.mono }}>
        {isEditing ? (
          <input 
            ref={inputRef}
            value={tempValue} 
            onChange={e => onTempChange(e.target.value)} 
            onBlur={onFinish}
            onKeyDown={e => e.key === 'Enter' && onFinish()}
            inputMode="text"
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 18, fontWeight: 800, fontFamily: F.mono, outline: 'none' }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
            {(() => {
              const n = parseFloat(String(val));
              if (isNaN(n)) return '—';
              if (isAx) return Math.round(n).toString();
              if (n > 25) return n.toFixed(2); 
              // No plus for visual acuity, axis, or bio fields
              const showPlus = !isAx && !field.includes('va') && !field.includes('k') && !field.includes('bio') && n >= 0;
              return (showPlus ? '+' : '') + n.toFixed(2);
            })()}
            {isAx && !isNaN(parseFloat(String(val))) && '°'}
            {unit && <span style={{ fontSize: 8, color: C.muted3, fontWeight: 700, marginLeft: 1 }}>{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

const CompactInput = ({ 
  field, color, val, isAx, isK, label, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef, onStep 
}: any) => {
  const step = isAx ? 5 : (field.includes('va') ? 0.05 : 0.25);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {label && <div style={{ fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '2px 4px', border: `1px solid ${isEditing ? color : C.border}40` }}>
        <button onClick={(e) => { e.stopPropagation(); onStep(field, -1, step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 10, padding: '0 2px', cursor: 'pointer' }}>−</button>
        <div 
          onClick={() => onStartEdit(field, val)}
          style={{ minWidth: 32, textAlign: 'center', fontSize: 10, fontFamily: F.mono, fontWeight: 700, color: color, cursor: 'text' }}
        >
          {isEditing ? (
            <input 
              ref={inputRef}
              value={tempValue} 
              onChange={e => onTempChange(e.target.value)} 
              onBlur={onFinish}
              onKeyDown={e => e.key === 'Enter' && onFinish()}
              inputMode="text"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 10, fontWeight: 700, fontFamily: F.mono, outline: 'none', padding: 0 }}
            />
          ) : (
            <>
              {(() => {
                const n = parseFloat(String(val));
                if (isNaN(n)) return '—';
                if (isAx) return Math.round(n).toString();
                if (n > 25) return n.toFixed(2); 
                // No plus for visual acuity or k
                const showPlus = !field.includes('va') && !field.includes('k') && n >= 0;
                return (showPlus ? '+' : '') + n.toFixed(2);
              })()}
              {isAx && !isNaN(parseFloat(String(val))) && '°'}
            </>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onStep(field, 1, step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 10, padding: '0 2px', cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
};

const FlatInput = ({ 
  field, color, val, isAx, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef 
}: any) => {
  return (
    <div onClick={() => onStartEdit(field, val)} style={{ minWidth: 32, textAlign: 'center', fontSize: 13, fontFamily: F.mono, fontWeight: 700, color: color, cursor: 'text' }}>
      {isEditing ? (
        <input 
          ref={inputRef}
          value={tempValue} 
          onChange={e => onTempChange(e.target.value)} 
          onBlur={onFinish}
          onKeyDown={e => e.key === 'Enter' && onFinish()}
          inputMode="text"
          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 13, fontWeight: 700, fontFamily: F.mono, outline: 'none', padding: 0 }}
        />
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
          {isAx && !isNaN(parseFloat(String(val))) && '°'}
        </>
      )}
    </div>
  );
};

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
  const [pMode, setPMode] = useState<'ANT' | 'POST' | 'TOTAL'>('ANT');

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
      // ПРИМЕЧАНИЕ: Передняя поверхность — собирающая (минус-цилиндр), 
      // Задняя — рассеивающая (плюс-цилиндр в эквиваленте).
      // Чтобы они вычитались при совпадении осей, знаки должны быть разными.
      const res = sumCylinders(-Math.abs(ac), aa, Math.abs(pc), pa);
      
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
    const val = (data as any)[field];
    const cur = parseFloat(val || (field.includes('k') && !field.includes('ax') ? '43' : '0'));
    let n = cur + (dir * step);
    const isAx = field.includes('ax');
    if (isAx) {
      if (n < 0) n = 180 + n;
      if (n >= 180) n = n - 180;
    }
    const nv = n.toFixed(isAx ? 0 : 2);
    // Remove plus sign for visual acuity (uva/bcva) and axis, keep for sph/cyl
    const showPlus = !isAx && !field.includes('va') && !field.includes('k') && n >= 0;
    set(field, isAx ? nv : (n > 25 ? nv : (showPlus ? '+' : '') + nv));
    haptic.light();
  };



  const runRealCalculation = async (formula: string) => {
    if (!draft) return;
    const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
    
    // ПРОВЕРКА ДАННЫХ
    if (!bio.al || !data.k1 || !data.k2) {
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
        k1: parseFloat(data.k1 || '0'),
        k2: parseFloat(data.k2 || '0'),
        k1_ax: parseFloat(data.k_ax || '0'),
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
            st.setIOLResult({ 
              ...(latestIOL || { 
                lens: currentLens, 
                aConst: currentA, 
                targetRefr: parseFloat(draft.targetRefr || '0'), 
                timestamp: new Date().toISOString(), 
                source: 'api' 
              }), 
              power: (emmetropia.power > 0 ? '+' : '') + emmetropia.power.toFixed(2) 
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
        <div style={{ background: C.card, borderRadius: 24, padding: '16px 14px 12px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {[
              { label: 'AL', field: 'al', unit: 'mm', color: C.text, step: 0.01 },
              { label: 'ACD', field: 'acd', unit: 'mm', color: C.text, step: 0.01 },
              { label: 'LT', field: 'lt', unit: 'mm', color: C.text, step: 0.01 },
              { label: 'WTW', field: 'wtw', unit: 'mm', color: C.text, step: 0.1 },
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
                    const cur = parseFloat(bio[f.field] || '0');
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
          
          <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}40`, paddingTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 54px', gap: 4, alignItems: 'center' }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>K-METRY</div>
              <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>K1</div>
              <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>K2</div>
              <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>AXIS</div>
              <div />
              
              <div style={{ height: 1 }} />
              <EntryCell field="k1" label="O-K1" color={C.amber} val={data.k1} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'k1'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
              <EntryCell field="k2" label="O-K2" color={C.amber} val={data.k2} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'k2'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
              <EntryCell field="k_ax" label="O-KAX" color={C.amber} val={data.k_ax} isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'k_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AxisDial axis={parseInt(data.k_ax || '0')} kAxis={parseInt(data.k_ax || '0')} size={48} color={C.amber} tickWidth={2} />
                </div>
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
                  padding: '0 16px', borderRadius: 10, border: 'none',
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
                        <WheelField
                          label="SIA"
                          value={draft.sia || '0.10'}
                          onChange={(v) => setDraft({ sia: v })}
                          min={0}
                          max={1.5}
                          step={0.05}
                          unit="D"
                          accentColor={C.indigo}
                          fw={800}
                          mini
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <WheelField
                          label="Incision"
                          value={draft.incAx || '90'}
                          onChange={(v) => setDraft({ incAx: v })}
                          min={0}
                          max={180}
                          step={5}
                          unit="°"
                          accentColor={C.indigo}
                          fw={800}
                          mini
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
              <span style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>UCVA</span>
              <CompactInput field="uva" color={C.text} val={data.uva} onStartEdit={handleStartEdit} isEditing={editingField === 'uva'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} />
            </div>
            <div style={{ flex: 1, background: C.surface, borderRadius: 12, padding: '6px 10px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>BCVA</span>
              <CompactInput field="bcva" color={C.green} val={data.bcva} onStartEdit={handleStartEdit} isEditing={editingField === 'bcva'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr 1fr 1fr 50px', columnGap: 4, rowGap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: ec.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Manifest</div>
            <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>SPH</div>
            <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>CYL</div>
            <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>AXIS</div>
            <div />

            <div style={{ height: 1 }} />
            <EntryCell field="man_sph" label="M-SPH" color={ec.color} val={data.man_sph} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="man_cyl" label="M-CYL" color={ec.color} val={data.man_cyl} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="man_ax" label="M-AX" color={ec.color} val={data.man_ax} isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AxisDial 
                  axis={parseInt(data.man_ax || '0')} 
                  kAxis={parseInt(data.k_ax || '0')} 
                  pAxis={parseInt(data.k1_ax || '0')}
                  size={44} color={ec.color} tickWidth={1.0} 
                />
              </div>
            </div>

            <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Corneal K</div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k1" label="K1" color={C.amber} val={data.k1} onStartEdit={handleStartEdit} isEditing={editingField === 'k1'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k2" label="K2" color={C.amber} val={data.k2} onStartEdit={handleStartEdit} isEditing={editingField === 'k2'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k_ax" label="KAX" color={C.amber} val={data.k_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'k_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div />

            <div style={{ fontSize: 8, color: C.indigo, fontWeight: 900, letterSpacing: '0.04em' }}>NARROW</div>
            <div style={{ textAlign: 'center' }}><FlatInput field="n_sph" color={C.text} val={data.n_sph} onStartEdit={handleStartEdit} isEditing={editingField === 'n_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="n_cyl" color={C.text} val={data.n_cyl} onStartEdit={handleStartEdit} isEditing={editingField === 'n_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="n_ax" color={C.text} val={data.n_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'n_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div />

            <div style={{ fontSize: 8, color: C.muted2, fontWeight: 900, letterSpacing: '0.04em' }}>WIDE</div>
            <div style={{ textAlign: 'center' }}><FlatInput field="c_sph" color={C.text} val={data.c_sph} onStartEdit={handleStartEdit} isEditing={editingField === 'c_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="c_cyl" color={C.text} val={data.c_cyl} onStartEdit={handleStartEdit} isEditing={editingField === 'c_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="c_ax" color={C.text} val={data.c_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'c_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div />
          </div>
        </div>
      )}

      {draft.type === 'refraction' && (
        <>
          <SectionLabel color={C.secondary || C.muted2} style={{ margin: '8px 0 4px 4px', fontSize: 10, letterSpacing: '0.14em', fontWeight: 700 }}>ASTIGMATISM · PENTACAM</SectionLabel>
          <div style={{ background: C.card, borderRadius: 24, padding: '16px 14px 12px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 10, color: C.indigo, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pentacam Station</span>
              <div style={{ display: 'flex', background: C.surface, borderRadius: 10, padding: 2, border: `1px solid ${C.border}` }}>
                {(['ANT', 'POST', 'TOTAL'] as const).map(m => (
                  <button key={m} onClick={() => setPMode(m)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: pMode === m ? C.cardHi : 'transparent', color: pMode === m ? C.text : C.muted2, fontFamily: F.sans, fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: pMode === 'TOTAL' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', 
              gap: 8, alignItems: 'center', marginBottom: 16 
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, alignItems: 'center' }}>
              <div style={{ background: C.surface, borderRadius: 12, padding: '8px 10px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>PACHY (CCT)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FlatInput field="cct" color={C.amber} val={data.cct} onStartEdit={handleStartEdit} isEditing={editingField === 'cct'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
                  <span style={{ fontSize: 9, color: C.muted3, fontWeight: 700 }}>µm</span>
                </div>
              </div>
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
