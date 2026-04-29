import React, { useState, useRef, useEffect } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { EyeToggle, SectionLabel, AxisDial, WheelField } from '../../../ui';
import { useTelegram } from '../../../hooks/useTelegram';
import { LensModal } from '../LensModal';
import { calculateIOL } from '../../../api/calculate';
import { T } from '../../../constants/translations';

const toMinus = (sph: string, cyl: string, ax: string) => {
  let s = parseFloat(sph) || 0;
  let c = parseFloat(cyl) || 0;
  let a = parseInt(ax) || 0;
  if (c > 0) {
    s += c;
    c = -c;
    a = (a + 90) % 180;
  }
  return { sph: s.toFixed(2), cyl: c.toFixed(2), ax: a.toString() };
};

const toPlus = (sph: string, cyl: string, ax: string) => {
  let s = parseFloat(sph) || 0;
  let c = parseFloat(cyl) || 0;
  let a = parseInt(ax) || 0;
  if (c < 0) {
    s += c;
    c = -c;
    a = (a + 90) % 180;
  }
  return { sph: s.toFixed(2), cyl: c.toFixed(2), ax: a.toString() };
};

const vectorSubtract = (c1: number, a1: number, c2: number, a2: number) => {
  const r1 = a1 * Math.PI / 90;
  const r2 = a2 * Math.PI / 90;
  const x = c1 * Math.cos(r1) - c2 * Math.cos(r2);
  const y = c1 * Math.sin(r1) - c2 * Math.sin(r2);
  const c = Math.sqrt(x * x + y * y);
  let a = Math.atan2(y, x) * 90 / Math.PI;
  if (a < 0) a += 180;
  return { cyl: c, ax: Math.round(a) };
};

const AutoRepeatButton = ({ onTrigger, children, style }: any) => {
  const timerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  const start = (e: any) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target && e.target.setPointerCapture && e.pointerId !== undefined) {
      try { e.target.setPointerCapture(e.pointerId); } catch(err){}
    }
    
    onTrigger();
    
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        onTrigger();
      }, 100);
    }, 400);
  };

  const stop = (e: any) => {
    if (e && e.target && e.target.releasePointerCapture && e.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch(err){}
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      style={{ ...style, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
    >
      {children}
    </button>
  );
};

const EntryCell = ({ 
  field, label, color, val, isAx, unit, stepOverride, onStep, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef 
}: any) => {
  const step = stepOverride || (isAx ? 5 : (field.includes('sph') || field.includes('cyl') ? 0.25 : (field.includes('va') ? 0.05 : 0.1)));

  return (
    <div 
      onClick={() => onStartEdit(field, val)}
      style={{ background: C.surface, borderRadius: 12, padding: '4px 4px 4px', border: `1px solid ${C.border}`, textAlign: 'center', cursor: 'text' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 3px', borderBottom: `1.5px solid ${C.border}50`, marginBottom: 3 }}>
        <AutoRepeatButton onTrigger={() => onStep(field, -1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '6px 12px', margin: '-6px -8px', cursor: 'pointer' }}>−</AutoRepeatButton>
        <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'flex-start' }}>
          {typeof label === 'string' && label.endsWith('*') ? (
            <>
              {label.replace('*', '')}
              <span style={{ fontSize: '1.1em', lineHeight: 0, marginTop: '2px', marginLeft: '1px' }}>*</span>
            </>
          ) : label}
        </div>
        <AutoRepeatButton onTrigger={() => onStep(field, 1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '6px 12px', margin: '-6px -8px', cursor: 'pointer' }}>+</AutoRepeatButton>
      </div>
      <div style={{ width: '100%', fontSize: 17, fontWeight: 900, color: color, fontFamily: F.mono, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {isEditing ? (
          <input 
            ref={inputRef}
            value={tempValue} 
            onChange={e => onTempChange(e.target.value)} 
            onBlur={onFinish}
            onKeyDown={e => e.key === 'Enter' && onFinish()}
            inputMode="text"
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 21, fontWeight: 900, fontFamily: F.mono, outline: 'none', fontVariantNumeric: 'tabular-nums' }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
            {(() => {
              const n = parseFloat(String(val));
              if (isNaN(n)) return '—';
              if (isAx) return Math.round(n).toString();
              if (n > 25) return n.toFixed(2); 
              const showPlus = !isAx && !field.includes('va') && !field.includes('k') && !field.includes('bio') && n >= 0;
              if (label.startsWith('K')) return n.toFixed(2);
              if (label === 'VA') return n.toFixed(1);
              return (showPlus ? '+' : '') + n.toFixed(2);
            })()}
            {isAx && !isNaN(parseFloat(String(val))) && <span style={{ fontSize: 11 }}>°</span>}
            {unit && <span style={{ fontSize: 7.5, color: C.muted3, fontWeight: 800, marginLeft: 1 }}>{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

const CompactInput = ({ 
  field, color, val, isAx, label, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef, onStep 
}: any) => {
  const step = isAx ? 5 : (field.includes('va') ? 0.05 : 0.25);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {label && <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: `${C.surface}80`, borderRadius: 10, padding: '4px 4px', border: `1px solid ${isEditing ? color : C.border}60` }}>
        <AutoRepeatButton onTrigger={() => onStep(field, -1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 16, padding: '8px 8px', margin: '-8px -4px', cursor: 'pointer' }}>−</AutoRepeatButton>
        <div 
          onClick={() => onStartEdit(field, val)}
          style={{ minWidth: field.includes('va') ? 50 : 40, textAlign: 'center', fontSize: field.includes('va') ? 22 : 12, fontFamily: F.mono, fontWeight: 900, color: color, cursor: 'text' }}
        >
          {isEditing ? (
            <input 
              ref={inputRef}
              value={tempValue} 
              onChange={e => onTempChange(e.target.value)} 
              onBlur={onFinish}
              onKeyDown={e => e.key === 'Enter' && onFinish()}
              inputMode="text"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: field.includes('va') ? 22 : 12, fontWeight: 900, fontFamily: F.mono, outline: 'none', padding: 0 }}
            />
          ) : (
            <>
              {(() => {
                const n = parseFloat(String(val));
                if (isNaN(n)) return '—';
                if (isAx) return Math.round(n).toString();
                if (n > 25) return n.toFixed(2); 
                if (field.includes('va')) return n.toFixed(1);
                const showPlus = !field.includes('va') && !field.includes('k') && n >= 0;
                return (showPlus ? '+' : '') + n.toFixed(2);
              })()}
              {isAx && !isNaN(parseFloat(String(val))) && '°'}
            </>
          )}
        </div>
        <AutoRepeatButton onTrigger={() => onStep(field, 1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 16, padding: '8px 8px', margin: '-8px -4px', cursor: 'pointer' }}>+</AutoRepeatButton>
      </div>
    </div>
  );
};

const FlatInput = ({ 
  field, color, val, isAx, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef 
}: any) => {
  return (
    <div onClick={() => onStartEdit(field, val)} style={{ minWidth: 40, textAlign: 'center', fontSize: 14, fontFamily: F.mono, fontWeight: 800, color: color, cursor: 'text' }}>
      {isEditing ? (
        <input 
          ref={inputRef}
          value={tempValue} 
          onChange={e => onTempChange(e.target.value)} 
          onBlur={onFinish}
          onKeyDown={e => e.key === 'Enter' && onFinish()}
          inputMode="text"
          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 14, fontWeight: 800, fontFamily: F.mono, outline: 'none', padding: 0 }}
        />
      ) : (
        <>
          {(() => {
            const n = parseFloat(String(val));
            if (isNaN(n)) return '—';
            if (isAx) return Math.round(n).toString();
            if (n > 25) return n.toFixed(2); 
            if (field.includes('va')) return n.toFixed(1);
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
    draft, setDraft, setIOLResult, setEyeField, setBioField, toggleSurgicalEye,
    formulaResults, setFormulaResults, iolLoading: isCalculating, setIOLLoading: setIsCalculating,
    iolError: calcError, setIOLError: setCalcError, toricResults, setToricResults
  } = useSessionStore();
  const { activeEye, setActiveEye, editingField, setEditingField, tempValue, setTempValue } = useUIStore();
  const { language } = useClinicStore();
  const t = T(language);
  const { haptic } = useTelegram();
  const [isLensModalOpen, setIsLensModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastCalc, setLastCalc] = useState<string | null>(null);
  const [pMode, setPMode] = useState<'ANT' | 'POST' | 'TOTAL'>('TOTAL');

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
      if (editingField === 'p_tot_c' || editingField === 'p_tot_a') {
        const currentData = { ...data, [editingField]: tempValue };
        const minus = toMinus(currentData.kavg || '43', currentData.p_tot_c || '0', currentData.p_tot_a || '0');
        setDraft({ 
          [activeEye]: { 
            ...data, 
            p_tot_c: minus.cyl, 
            p_tot_a: minus.ax 
          } 
        } as any);
      } else {
        set(editingField, tempValue);
      }
    }
    setEditingField(null);
  };

  const handleStep = (field: string, dir: number, step: number) => {
    const latestDraft = useSessionStore.getState().draft;
    if (!latestDraft) return;
    const latestData = latestDraft[activeEye] || {};
    const val = (latestData as any)[field];
    const cur = parseFloat(val || (field.includes('k') && !field.includes('ax') ? '43' : '0'));
    let n = cur + (dir * step);
    const isAx = field.includes('ax');
    if (isAx) { if (n < 0) n = 180 + n; if (n >= 180) n = n - 180; }
    const nv = n.toFixed(isAx ? 0 : 2);
    const showPlus = !isAx && !field.includes('va') && !field.includes('k') && n >= 0;
    set(field, isAx ? nv : (n > 25 ? nv : (showPlus ? '+' : '') + nv));
    haptic.selection();
  };

  const runRealCalculation = async (formula: string) => {
    if (!draft) return;
    const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
    if (!bio.al || !data.k1 || !data.k2) { setCalcError("MISSING AL/K1/K2"); return; }

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
        iol_db: (draft as any).toricDB || latestIOL?.lens || 'Alcon SN6AT',
        n_aq_label: (draft as any).toricNAq || 'Standard (1.336)',
        k_ax_is_steep: (draft as any).toricKaxIsSteep !== false,
      } as any);

      const rawResults = res.results || res.data;
      if (res.status === 'ok' && rawResults) {
        const updatedFormulaMap = Array.isArray(rawResults) 
          ? { ...(formulaResults[activeEye] || {}), [formula]: rawResults }
          : { ...(formulaResults[activeEye] || {}), ...rawResults };
        
        setFormulaResults({ ...formulaResults, [activeEye]: updatedFormulaMap });
        setLastCalc(new Date().toLocaleTimeString());

        if (res.toric) setToricResults({ ...toricResults, [activeEye]: res.toric });

        const currentResults = Array.isArray(rawResults) ? rawResults : (rawResults[formula] || []);
        const storeIOL = useSessionStore.getState().iolResult;
        if (!storeIOL?.power || storeIOL.power === '—') {
          const emmetropia = currentResults.find((r: any) => r.is_emmetropia);
          if (emmetropia) {
            setIOLResult({ 
              ...(storeIOL || { lens: draft.iolResult?.lens || 'AcrySof IQ', aConst: (draft.iolResult as any)?.aConst || 119.3, targetRefr: parseFloat(draft.targetRefr || '0'), timestamp: new Date().toISOString(), source: 'api' }), 
              power: (emmetropia.power > 0 ? '+' : '') + emmetropia.power.toFixed(2) 
            });
          }
        }
      } else {
        setCalcError(res.detail || 'Calculation Error');
      }
    } catch (e) {
      setCalcError('Connection Failed');
    } finally {
      setIsCalculating(false);
    }
  };
  
  const getALHint = (val: string) => {
    const al = parseFloat(val);
    if (isNaN(al) || al === 0) return null;
    if (al < 22) return { text: t.shortEyeHint, color: C.os };
    if (al > 24.5) return { text: t.longEyeHint, color: C.od };
    return { text: t.averageEyeHint, color: C.muted3 };
  };

  const getACDHint = (val: string) => {
    const acd = parseFloat(val);
    if (isNaN(acd) || acd === 0) return null;
    if (acd < 2.5) return { text: t.shallowAcdHint, color: C.os };
    if (acd > 3.5) return { text: t.deepAcdHint, color: C.green };
    return null;
  };

  const disabledEyes: ('od' | 'os')[] = [];
  const currentEye = (draft.eye || 'OU').toUpperCase();
  if (currentEye === 'OD') disabledEyes.push('os');
  if (currentEye === 'OS') disabledEyes.push('od');

  const handleLongPressEye = (eye: 'od' | 'os') => {
    haptic.impact('heavy');
    toggleSurgicalEye(eye);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle value={activeEye} onChange={setActiveEye} disabledEyes={disabledEyes} onLongPress={handleLongPressEye} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 0 4px' }}>
        <SectionLabel color={C.indigo} style={{ margin: 0, fontSize: 10, letterSpacing: '0.14em', fontWeight: 900 }}>
          {draft.type === 'cataract' ? t.biometry.toUpperCase() : t.diagnostics.toUpperCase()}
        </SectionLabel>
      </div>
      
      {draft.type === 'cataract' ? (
        <div style={{ background: C.card, borderRadius: 24, padding: '12px 4px 8px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '8px 1fr 1fr 1fr 1fr 8px', gap: 3, alignItems: 'center' }}>
            <div />
            {[
              { label: 'AL', field: 'al', unit: 'mm', color: C.text, step: 0.01 },
              { label: 'ACD', field: 'acd', unit: 'mm', color: C.text, step: 0.01 },
              { label: 'LT*', field: 'lt', unit: 'mm', color: C.text, step: 0.01 },
              { label: 'WTW*', field: 'wtw', unit: 'mm', color: C.text, step: 0.1 },
            ].map(f => {
              const bio = draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] || {};
              const hint = f.field === 'al' ? getALHint(bio[f.field]) : (f.field === 'acd' ? getACDHint(bio[f.field]) : null);
              
              return (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <div style={{ width: '100%', padding: '0 1px' }}>
                    <EntryCell 
                      field={`bio_${f.field}`} label={f.label} unit={f.unit} color={f.color} val={bio[f.field]}
                      stepOverride={f.step} onStep={(field: string, dir: number, step: number) => {
                        const cur = parseFloat(bio[f.field] || '0');
                        setBioField(activeEye, f.field, (cur + dir * step).toFixed(2));
                        haptic.selection();
                      }}
                      onStartEdit={handleStartEdit} isEditing={editingField === `bio_${f.field}`} tempValue={tempValue} onTempChange={setTempValue}
                      onFinish={() => { setBioField(activeEye, f.field, tempValue); setEditingField(null); }} inputRef={inputRef}
                    />
                  </div>
                  {hint && (
                    <span style={{ 
                      position: 'absolute', bottom: -14, left: 0, right: 0,
                      fontSize: 6.5, 
                      fontWeight: 900, 
                      color: hint.color, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.02em', 
                      textAlign: 'center',
                      opacity: 0.9,
                      lineHeight: 1,
                      pointerEvents: 'none'
                    }}>
                      {hint.text}
                    </span>
                  )}
                </div>
              );
            })}
            <div />
          </div>
          
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}40`, paddingTop: 10, paddingBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 0 4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '12px minmax(65px, 75px) minmax(65px, 75px)', gridTemplateRows: 'auto auto', gap: '10px 8px', alignItems: 'center' }}>
                <div style={{ gridColumn: '1', gridRow: '1 / span 2', fontSize: 7.5, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.06em', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', opacity: 0.8 }}>{t.kMetry}</div>
                
                <div style={{ gridColumn: '2', gridRow: '1' }}>
                  <EntryCell field="k1" label="K1" color={C.amber} val={data.k1} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'k1'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
                </div>
                <div style={{ gridColumn: '3', gridRow: '1' }}>
                  <EntryCell field="k_ax" label="AX 1" color={C.amber} val={data.k_ax} isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'k_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
                </div>
                
                <div style={{ gridColumn: '2', gridRow: '2' }}>
                  <EntryCell field="k2" label="K2" color={C.amber} val={data.k2} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'k2'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
                </div>
                <div style={{ gridColumn: '3', gridRow: '2', opacity: 0.5, pointerEvents: 'none' }}>
                  <EntryCell field="k2_ax" label="AX 2" color={C.amber} val={data.k_ax ? ((parseInt(data.k_ax) + 90) % 180 || 180).toString() : ''} isAx onStep={()=>{}} onStartEdit={()=>{}} isEditing={false} tempValue="" onTempChange={()=>{}} onFinish={()=>{}} inputRef={null} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, paddingLeft: 12 }}>
                <div style={{ fontSize: 7.5, fontWeight: 900, color: C.muted2, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {(() => {
                    const k1v = parseFloat(data.k1 as string);
                    const k2v = parseFloat(data.k2 as string);
                    if (!isNaN(k1v) && !isNaN(k2v)) {
                      const cyl = Math.abs(k1v - k2v).toFixed(2);
                      return `CYL -${cyl} AX ${data.k_ax || '0'}°`;
                    }
                    return 'CORNEAL ASTIGMATISM';
                  })()}
                </div>
                <div style={{ width: 106, height: 106, borderRadius: '50%', background: `${C.surface}80`, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)' }}>
                  <AxisDial axis={parseInt((data.k_ax as string) || '0')} kAxis={parseInt((data.k_ax as string) || '0')} size={96} color={C.amber} tickWidth={2.5} />
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 900, color: C.indigo, letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4 }}>
                  {t.lensModel}
                </label>
                <div 
                  onClick={() => { haptic.impact('medium'); setIsLensModalOpen(true); }} 
                  style={{ background: C.surface, borderRadius: 14, padding: '12px 16px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', height: 44 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{draft.iolResult?.lens || t.selectLens}</span>
                  <div style={{ background: `${C.indigo}15`, borderRadius: 8, padding: '4px 10px', color: C.indigo, fontSize: 9, fontWeight: 900 }}>{t.choose.toUpperCase()}</div>
                </div>
              </div>
              <div style={{ width: 110 }}>
                <WheelField label={t.target} value={draft.targetRefr || '0.00'} onChange={(v) => { haptic.selection(); setDraft({ targetRefr: v }); }} min={-3} max={3} step={0.25} unit="D" accentColor={C.green} accentText fw={900} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', gap: 4, background: C.surface, padding: 3, borderRadius: 12, border: `1px solid ${C.border}` }}>
                {(['Haigis', 'Barrett', 'Kane'] as const).map(f => (
                  <div key={f} onClick={() => { haptic.selection(); setDraft({ activeFormula: f }); }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 9, textAlign: 'center', background: draft.activeFormula === f ? `${C.indigo}15` : 'transparent', color: draft.activeFormula === f ? C.indigo : C.muted2, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}>{f}</div>
                ))}
              </div>
              <button onClick={() => { haptic.notification('success'); runRealCalculation(draft.activeFormula || 'Barrett'); }} disabled={isCalculating}
                style={{ padding: '0 20px', borderRadius: 12, border: 'none', background: isCalculating ? C.surface : C.indigo, color: isCalculating ? C.muted3 : '#fff', fontSize: 11, fontWeight: 900, letterSpacing: '0.06em', cursor: isCalculating ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: isCalculating ? 'none' : `0 6px 16px ${C.indigo}40` }}>
                {isCalculating ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid #fff3`, borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> : <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {isCalculating ? '...' : t.calcBtn.toUpperCase()}
              </button>
            </div>

            <div
              onClick={() => { 
                haptic.selection(); 
                const newMode = !draft.toricMode;
                setDraft({ 
                  toricMode: newMode,
                  ...(newMode && !((draft as any).toricNAq) ? { toricNAq: 'Alcon (1.3375)' } : {})
                } as any); 
              }}
              style={{ padding: '12px 14px', background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: C.text, textTransform: 'uppercase' }}>{t.toricCalculator}</span>
                {draft.toricMode && toricResults?.[activeEye] && (
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.indigo, textTransform: 'uppercase' }}>
                    {toricResults[activeEye].best_model} @ {toricResults[activeEye].total_steep_axis}° · BVR {toricResults[activeEye].bvr}
                  </span>
                )}
              </div>
              <div style={{ width: 40, height: 22, borderRadius: 12, background: draft.toricMode ? C.indigo : C.border, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 3, left: draft.toricMode ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
              </div>
            </div>

            {draft.toricMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px', background: C.card, borderRadius: 18, border: `1px solid ${C.border}` }}>
                {/* SIA & INC AX */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>SIA</div>
                    <input
                      value={editingField === 'sia' ? tempValue : (draft.sia ?? '0.10')}
                      onChange={e => {
                        setTempValue(e.target.value);
                        if (editingField !== 'sia') setEditingField('sia');
                      }}
                      onFocus={() => { setTempValue(draft.sia ?? '0.10'); setEditingField('sia'); }}
                      onBlur={() => { setDraft({ sia: tempValue }); setEditingField(null); }}
                      style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 16, fontWeight: 900, fontFamily: F.mono, width: '100%', outline: 'none', textAlign: 'center' }}
                    />
                  </div>
                  <div style={{ flex: 1, position: 'relative', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>INCISION AX</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      <input
                        value={editingField === 'incAx' ? tempValue : (draft.incAx ?? '90')}
                        onChange={e => {
                          setTempValue(e.target.value);
                          if (editingField !== 'incAx') setEditingField('incAx');
                        }}
                        onFocus={() => { setTempValue(draft.incAx ?? '90'); setEditingField('incAx'); }}
                        onBlur={() => { setDraft({ incAx: tempValue }); setEditingField(null); }}
                        style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 16, fontWeight: 900, fontFamily: F.mono, width: '32px', outline: 'none', textAlign: 'right' }}
                      />
                      <span style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: F.mono, marginLeft: 2 }}>°</span>
                    </div>
                  </div>
                </div>
                
                {/* IOL Model Auto-Sync */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Toric Lens Sync</div>
                  <div style={{ padding: '8px 12px', borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.indigo }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.text }}>{draft.iolResult?.lens || 'No Lens Selected'}</span>
                  </div>
                </div>
                {/* Refractive Index */}
                <div>
                  <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Refractive Index n_aq</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['1.336', 'Standard (1.336)'], ['1.333', 'Gullstrand (1.333)'], ['1.3375', 'Alcon (1.3375)']].map(([label, key]) => {
                      const active = ((draft as any).toricNAq || 'Standard (1.336)') === key;
                      return (
                        <button key={key} onClick={e => { e.stopPropagation(); haptic.light(); setDraft({ toricNAq: key } as any); }}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1px solid ${active ? C.indigo : C.border}`, background: active ? `${C.indigo}18` : C.surface, color: active ? C.indigo : C.muted2, fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* K-axis convention */}
                <div onClick={e => { e.stopPropagation(); haptic.light(); setDraft({ toricKaxIsSteep: (draft as any).toricKaxIsSteep === false ? true : false } as any); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 8.5, fontWeight: 900, color: C.text }}>K-axis convention</div>
                    <div style={{ fontSize: 7, color: C.muted3 }}>
                      {(draft as any).toricKaxIsSteep !== false ? 'K-axis = STEEP (Pentacam/Topcon)' : 'K-axis = FLAT K1 (IOLMaster/Lenstar)'}
                    </div>
                  </div>
                  <div style={{ width: 34, height: 18, borderRadius: 10, background: (draft as any).toricKaxIsSteep !== false ? C.amber : C.border, position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: (draft as any).toricKaxIsSteep !== false ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: C.card, borderRadius: 24, padding: '18px 14px 14px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: C.surface, borderRadius: 16, padding: '10px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: C.muted2 }}>UCVA</span>
              <CompactInput field="uva" color={C.text} val={data.uva ? parseFloat(data.uva).toFixed(1) : ''} onStartEdit={handleStartEdit} isEditing={editingField === 'uva'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} />
            </div>
            <div style={{ flex: 1, background: C.surface, borderRadius: 16, padding: '10px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: C.muted2 }}>BCVA</span>
              <CompactInput field="bcva" color={C.green} val={data.bcva ? parseFloat(data.bcva).toFixed(1) : ''} onStartEdit={handleStartEdit} isEditing={editingField === 'bcva'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr 1fr 1fr 58px', columnGap: 3, rowGap: 8, alignItems: 'center' }}>
            <div />
            <div style={{ fontSize: 7, color: C.muted2, textAlign: 'center', fontWeight: 900 }}>SPH</div>
            <div style={{ fontSize: 7, color: C.muted2, textAlign: 'center', fontWeight: 900 }}>CYL</div>
            <div style={{ fontSize: 7, color: C.muted2, textAlign: 'center', fontWeight: 900 }}>{t.axis.toUpperCase()}</div>
            <div style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>ASTIG. AXIS</div>

            <div style={{ fontSize: 7, fontWeight: 900, color: ec.color, textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.manifest}</div>
            <EntryCell field="man_sph" label="M-SPH" color={ec.color} val={data.man_sph} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="man_cyl" label="M-CYL" color={ec.color} val={data.man_cyl} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="man_ax" label="M-AX" color={ec.color} val={data.man_ax} isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'man_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <AxisDial 
                axis={parseInt(data.man_ax || '0')} 
                kAxis={parseInt(data.k_ax || '0')}
                pAxis={parseInt(data.p_tot_a || '0')}
                size={42} color={ec.color} tickWidth={1.5} 
              />
            </div>

            <div style={{ fontSize: 7, fontWeight: 900, color: C.amber, textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.cornealK}</div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k1" label="K1" color={C.amber} val={data.k1} onStartEdit={handleStartEdit} isEditing={editingField === 'k1'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k2" label="K2" color={C.amber} val={data.k2} onStartEdit={handleStartEdit} isEditing={editingField === 'k2'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k_ax" label="KAX" color={C.amber} val={data.k_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'k_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div />

            <div style={{ fontSize: 7, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.narrow}</div>
            <div style={{ textAlign: 'center' }}><FlatInput field="n_sph" color={C.text} val={data.n_sph} onStartEdit={handleStartEdit} isEditing={editingField === 'n_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="n_cyl" color={C.text} val={data.n_cyl} onStartEdit={handleStartEdit} isEditing={editingField === 'n_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="n_ax" color={C.text} val={data.n_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'n_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div />

            <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.wide}</div>
            <div style={{ textAlign: 'center' }}><FlatInput field="c_sph" color={C.muted2} val={data.c_sph} onStartEdit={handleStartEdit} isEditing={editingField === 'c_sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="c_cyl" color={C.muted2} val={data.c_cyl} onStartEdit={handleStartEdit} isEditing={editingField === 'c_cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div style={{ textAlign: 'center' }}><FlatInput field="c_ax" color={C.muted2} val={data.c_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'c_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} /></div>
            <div />
          </div>
        </div>
      )}

      {draft.type === 'refraction' && (
        <>
          <SectionLabel color={C.indigo} style={{ margin: '8px 0 0 4px', fontSize: 10, letterSpacing: '0.14em', fontWeight: 900 }}>{t.astigmatism.toUpperCase()} · PENTACAM</SectionLabel>
          <div style={{ background: C.card, borderRadius: 24, padding: '12px 14px 10px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: C.surface, padding: '2px', borderRadius: 14, border: `1px solid ${C.border}60`, marginBottom: 12 }}>
              <div style={{ display: 'flex', flex: 1 }}>
                {(['ANT', 'POST', 'TOTAL'] as const).map(m => {
                  const active = pMode === m;
                  return (
                    <button key={m} onClick={() => { haptic.selection(); setPMode(m); }}
                      style={{ 
                        flex: 1, padding: '4px 0', borderRadius: 10, border: 'none', 
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent', 
                        color: active ? C.text : C.muted2, fontSize: 8.5, fontWeight: 900, 
                        textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.04em' 
                      }}>
                      {m}
                    </button>
                  );
                })}
              </div>
              <div style={{ width: 1, height: 12, background: C.border, margin: '0 4px', opacity: 0.5 }} />
              <button 
                onClick={() => {
                  haptic.impact('medium');
                  const antC = parseFloat(data.p_ant_c) || 0;
                  const antA = parseFloat(data.p_ant_a) || 0;
                  const postC = parseFloat(data.p_post_c) || 0;
                  const postA = parseFloat(data.p_post_a) || 0;
                  
                  // Vector subtraction for divergent posterior surface
                  const result = vectorSubtract(antC, antA, postC, postA);
                  
                  // Convert result to minus notation
                  const totalMinus = toMinus(data.kavg, result.cyl.toString(), result.ax.toString());
                  
                  setDraft({ 
                    [bioEye]: {
                      ...data,
                      p_tot_c: totalMinus.cyl, 
                      p_tot_a: totalMinus.ax 
                    }
                  } as any);
                }}
                style={{
                  padding: '4px 8px', borderRadius: 10, border: 'none', background: 'transparent',
                  color: C.indigo, fontSize: 8.5, fontWeight: 900, cursor: 'pointer'
                }}
              >
                SYNC
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <EntryCell 
                field="kavg" 
                label={`${pMode}-AVG`} 
                color={C.text} 
                val={data.kavg} 
                stepOverride={0.1} 
                onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'kavg'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} 
              />
              <EntryCell 
                field={pMode === 'ANT' ? 'p_ant_c' : pMode === 'POST' ? 'p_post_c' : 'p_tot_c'} 
                label={`${pMode}-CYL`} 
                color={C.indigo} 
                val={pMode === 'ANT' ? data.p_ant_c : pMode === 'POST' ? data.p_post_c : data.p_tot_c} 
                onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === (pMode === 'ANT' ? 'p_ant_c' : pMode === 'POST' ? 'p_post_c' : 'p_tot_c')} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} 
              />
              <EntryCell 
                field={pMode === 'ANT' ? 'p_ant_a' : pMode === 'POST' ? 'p_post_a' : 'p_tot_a'} 
                label={`${pMode}-AX`} 
                color={C.indigo} 
                val={pMode === 'ANT' ? data.p_ant_a : pMode === 'POST' ? data.p_post_a : data.p_tot_a} 
                isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === (pMode === 'ANT' ? 'p_ant_a' : pMode === 'POST' ? 'p_post_a' : 'p_tot_a')} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} 
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8, alignItems: 'center' }}>
              <div style={{ background: C.surface, borderRadius: 14, padding: '6px 12px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2 }}>{t.antAstig.toUpperCase()}</span>
                <FlatInput field="p_ant_c" color={C.text} val={data.p_ant_c} onStartEdit={handleStartEdit} isEditing={editingField === 'p_ant_c'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
              </div>
              <div style={{ background: C.surface, borderRadius: 14, padding: '6px 12px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2 }}>{t.postAstig.toUpperCase()}</span>
                <FlatInput field="p_post_c" color={C.muted3} val={data.p_post_c} onStartEdit={handleStartEdit} isEditing={editingField === 'p_post_c'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
              </div>
              <div style={{ background: C.surface, borderRadius: 14, padding: '6px 12px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2 }}>{t.pachy.toUpperCase()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FlatInput field="cct" color={C.amber} val={data.cct} onStartEdit={handleStartEdit} isEditing={editingField === 'cct'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
                  <span style={{ fontSize: 10, color: C.muted3, fontWeight: 800 }}>µm</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {isLensModalOpen && <LensModal isOpen={isLensModalOpen} onClose={() => setIsLensModalOpen(false)} />}
    </div>
  );
}
