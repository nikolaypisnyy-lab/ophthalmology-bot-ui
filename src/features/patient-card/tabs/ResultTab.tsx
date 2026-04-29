import React, { useState, useRef, useEffect } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { PERIOD_KEYS, PERIOD_LABELS } from '../../../types/results';
import { EyeToggle, SectionLabel, AxisDial } from '../../../ui';
import { useTelegram } from '../../../hooks/useTelegram';
import { T } from '../../../constants/translations';

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
      intervalRef.current = setInterval(() => { onTrigger(); }, 100);
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
      onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
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
    <div onClick={() => onStartEdit(field, val)}
      style={{ background: C.surface, borderRadius: 14, padding: '4px 4px 6px', border: `1px solid ${C.border}`, textAlign: 'center', cursor: 'text', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 3px', borderBottom: `1px solid ${C.border}30`, marginBottom: 3 }}>
        <AutoRepeatButton onTrigger={() => onStep(field, -1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -6px', cursor: 'pointer' }}>−</AutoRepeatButton>
        <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <AutoRepeatButton onTrigger={() => onStep(field, 1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -6px', cursor: 'pointer' }}>+</AutoRepeatButton>
      </div>
      <div style={{ width: '100%', fontSize: 22, fontWeight: 900, color: color, fontFamily: F.mono }}>
        {isEditing ? (
          <input ref={inputRef} value={tempValue} onChange={e => onTempChange(e.target.value)} onBlur={onFinish} onKeyDown={e => e.key === 'Enter' && onFinish()} inputMode="text"
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 20, fontWeight: 900, fontFamily: F.mono, outline: 'none' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
            {(() => {
              const n = parseFloat(String(val));
              if (isNaN(n)) return '—';
              if (isAx) return Math.round(n).toString();
              if (n > 25) return n.toFixed(2); 
              const showPlus = !isAx && !field.includes('va') && !field.includes('k') && n >= 0;
              if (field.includes('va')) return n.toFixed(1);
              return (showPlus ? '+' : '') + n.toFixed(2);
            })()}
            {isAx && !isNaN(parseFloat(String(val))) && <span style={{ fontSize: 12 }}>°</span>}
            {unit && <span style={{ fontSize: 9, color: C.muted3, fontWeight: 800, marginLeft: 2 }}>{unit}</span>}
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
      {label && <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: `${C.surface}80`, borderRadius: 10, padding: '2px 4px', border: `1px solid ${isEditing ? color : C.border}60` }}>
        <AutoRepeatButton onTrigger={() => onStep(field, -1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 14, padding: '4px 6px', margin: '-4px -2px', cursor: 'pointer' }}>−</AutoRepeatButton>
        <div onClick={() => onStartEdit(field, val)} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontFamily: F.mono, fontWeight: 800, color: color, cursor: 'text' }}>
          {isEditing ? (
            <input ref={inputRef} value={tempValue} onChange={e => onTempChange(e.target.value)} onBlur={onFinish} onKeyDown={e => e.key === 'Enter' && onFinish()} inputMode="text"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 12, fontWeight: 800, fontFamily: F.mono, outline: 'none', padding: 0 }} />
          ) : (
            <>{(() => {
                const n = parseFloat(String(val));
                if (isNaN(n)) return '—';
                if (isAx) return Math.round(n).toString();
                if (n > 25) return n.toFixed(2); 
                const showPlus = !field.includes('va') && !field.includes('k') && n >= 0;
                return (showPlus ? '+' : '') + n.toFixed(2);
              })()}{isAx && !isNaN(parseFloat(String(val))) && '°'}</>
          )}
        </div>
        <AutoRepeatButton onTrigger={() => onStep(field, 1, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 14, padding: '4px 6px', margin: '-4px -2px', cursor: 'pointer' }}>+</AutoRepeatButton>
      </div>
    </div>
  );
};

const CompareRow = ({ label, pre, plan, result, unit = '', color }: any) => {
  const fmt = (v: any, isPlan?: boolean) => {
    if (v === undefined || v === '' || v === null) return isPlan ? '' : '—';
    const n = parseFloat(String(v));
    if (isNaN(n)) return '—';
    if (label.startsWith('K')) return n.toFixed(2);
    if (label === 'VA') return n.toFixed(1);
    return (n > 0 ? '+' : '') + n.toFixed(2);
  };
  const isNum = unit !== '°' && unit !== '';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 2, alignItems: 'center', padding: '1px 0' }}>
      <span style={{ fontSize: 9, fontWeight: 900, color: color || C.muted2, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted2, textAlign: 'center' }}>{isNum ? fmt(pre) : pre}{pre && unit}</span>
      <span style={{ fontFamily: F.mono, fontSize: 11, color: C.indigo, textAlign: 'center' }}>{isNum ? fmt(plan, true) : plan}{plan && unit}</span>
      <span style={{ fontFamily: F.mono, fontSize: 11, color: color || C.text, fontWeight: 800, textAlign: 'center' }}>{isNum ? fmt(result) : result}{result && unit}</span>
    </div>
  );
};

const getVAColor = (va?: string) => {
  const n = parseFloat(va ?? '');
  if (isNaN(n)) return C.text;
  if (n >= 0.9) return C.green;
  if (n >= 0.5) return C.amber;
  return C.red;
};

const getSE = (sph: any, cyl: any) => {
  const s = parseFloat(String(sph ?? '')) || 0;
  const c = parseFloat(String(cyl ?? '')) || 0;
  const se = s + c / 2;
  return (se >= 0 ? '+' : '') + se.toFixed(2);
};

export function ResultTab({ onSave, isSaving }: { onSave: () => void, isSaving: boolean }) {
  const { draft, setPeriodEyeField, iolResult, toricResults } = useSessionStore();
  const { activePeriod, setActivePeriod, resultEye, setResultEye, editingField, setEditingField, tempValue, setTempValue } = useUIStore();
  const { language } = useClinicStore();
  const t = T(language);
  const { haptic } = useTelegram();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const resultEyeRef = useRef(resultEye);
  useEffect(() => {
    if (resultEye !== resultEyeRef.current) {
      if (editingField) {
        setPeriodEyeField(activePeriod, resultEyeRef.current, editingField as any, tempValue);
        setEditingField(null);
      }
      resultEyeRef.current = resultEye;
    }
  }, [resultEye, editingField, tempValue, setPeriodEyeField, activePeriod, setEditingField]);

  if (!draft) return null;
  const isCat = draft.type === 'cataract';
  const periodData = draft.periods?.[activePeriod] ?? {};
  const eyeData = periodData[resultEye] ?? {};
  const ec = eyeColors(resultEye);

  const set = (f: string, v: string) => setPeriodEyeField(activePeriod, resultEye, f as any, v);

  const handleStartEdit = (field: string, val: any) => {
    setTempValue(String(val || ''));
    setEditingField(field);
  };

  const handleFinishEdit = () => {
    if (editingField) set(editingField, tempValue);
    setEditingField(null);
  };

  const handleStep = (field: string, dir: number, step: number) => {
    const latestDraft = useSessionStore.getState().draft;
    if (!latestDraft) return;
    const latestPeriodData = latestDraft.periods?.[activePeriod] ?? {};
    const latestEyeData = latestPeriodData[resultEye] ?? {};
    
    const val = (latestEyeData as any)[field];
    const cur = parseFloat(val || '0');
    let n = cur + (dir * step);
    const isAx = field.includes('ax');
    if (isAx) { if (n < 0) n = 180 + n; if (n >= 180) n = n - 180; }
    const nv = n.toFixed(isAx ? 0 : 2);
    const showPlus = !isAx && !field.includes('va') && !field.includes('k') && n >= 0;
    set(field, isAx ? nv : (n > 25 ? nv : (showPlus ? '+' : '') + nv));
    haptic.selection();
  };

  const preEye = draft[resultEye] || {};
  const planEye = draft.savedPlan?.[resultEye] as any;
  const disabledEyes: ('od' | 'os')[] = [];
  const currentEye = (draft.eye || 'OU').toUpperCase();
  if (currentEye === 'OD') disabledEyes.push('os');
  if (currentEye === 'OS') disabledEyes.push('od');

  const handleLongPressEye = (eye: 'od' | 'os') => {
    haptic.impact('heavy');
    useSessionStore.getState().toggleSurgicalEye(eye);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle value={resultEye} onChange={setResultEye} disabledEyes={disabledEyes} onLongPress={handleLongPressEye} />
      </div>

      {isCat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SectionLabel color={ec.color}>{t.surgicalSummary.toUpperCase()} {resultEye.toUpperCase()}</SectionLabel>
          <div style={{ background: `linear-gradient(145deg, ${C.surface} 0%, ${C.bg} 100%)`, border: `1px solid ${C.border}`, borderRadius: 24, padding: '12px 16px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: ec.color }} /><span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>{t.implantedIOL}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>
                    {iolResult?.lens || t.noLensSelected.toUpperCase()}
                  </span>
                  {toricResults?.[resultEye]?.best_model && <span style={{ fontSize: 9, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', marginTop: 4 }}>{t.toricComponent}: {toricResults[resultEye].best_model}</span>}
                </div>
              </div>
              <div style={{ background: `${ec.color}15`, borderRadius: 16, padding: '12px 18px', border: `1px solid ${ec.color}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: ec.color, textTransform: 'uppercase', marginBottom: 2 }}>{t.power}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                  {(() => { 
                    const eyeRes = (iolResult as any)?.[resultEye];
                    const p = eyeRes?.selectedPower ?? eyeRes?.p_emmetropia ?? (iolResult as any)?.power; 
                    if (p === undefined || p === null) return '—'; 
                    const num = typeof p === 'number' ? p : parseFloat(String(p)); 
                    if (isNaN(num)) return '—';
                    return (num > 0 ? '+' : '') + num.toFixed(2); 
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isCat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SectionLabel color={ec.color}>{t.comparison.toUpperCase()} {resultEye.toUpperCase()}</SectionLabel>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '8px 10px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ background: `${C.surface}80`, borderRadius: 18, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, border: `1px solid ${C.border}40` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 2, marginBottom: 2 }}>
                <span />
                {(['PRE', 'PLAN', 'FACT'] as const).map(h => (<span key={h} style={{ fontSize: 8, fontWeight: 900, color: h === 'FACT' ? C.text : h === 'PLAN' ? C.indigo : C.muted2, textAlign: 'center', textTransform: 'uppercase' }}>{h}</span>))}
              </div>
              <CompareRow label="Sph" pre={preEye.man_sph} plan={planEye?.sph} result={eyeData.sph} unit="D" />
              <CompareRow label="Cyl" pre={preEye.man_cyl} plan={planEye?.cyl} result={eyeData.cyl} unit="D" />
              <CompareRow label={t.axis} pre={preEye.man_ax} plan={planEye?.ax} result={eyeData.ax} unit="°" />
              <CompareRow label="SE" pre={getSE(preEye.man_sph, preEye.man_cyl)} result={getSE(eyeData.sph, eyeData.cyl)} unit="D" color={C.green} />
              <div style={{ height: '1px', background: C.border, opacity: 0.2, margin: '2px 0' }} />
              <CompareRow label="K1" pre={preEye.k1} result={eyeData.k1} unit="D" />
              <CompareRow label="K2" pre={preEye.k2} result={eyeData.k2} unit="D" />
              <CompareRow label="VA" pre={preEye.uva} result={eyeData.va} color={getVAColor(String(eyeData.va))} />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
        {PERIOD_KEYS.map(p => {
          const active = activePeriod === p;
          const hasData = !!(draft.periods?.[p]?.od?.sph || draft.periods?.[p]?.od?.va || draft.periods?.[p]?.os?.sph || draft.periods?.[p]?.os?.va);
          return (
            <button key={p} onClick={() => { haptic.selection(); setActivePeriod(p); }} style={{ flex: 1, minWidth: 48, padding: '3px 1px', borderRadius: 12, border: `2px solid ${active ? C.indigo : hasData ? `${C.indigo}40` : C.border}`, background: active ? `${C.indigo}15` : 'transparent', color: active ? C.indigo : hasData ? C.text : C.muted3, fontSize: 9.5, fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
              {PERIOD_LABELS[p]}
              {hasData && !active && <span style={{ position: 'absolute', top: 2, right: 3, width: 3.5, height: 3.5, borderRadius: '50%', background: C.indigo }} />}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SectionLabel color={ec.color}>{t.result.toUpperCase()} {resultEye.toUpperCase()} — {PERIOD_LABELS[activePeriod]}</SectionLabel>
        <div style={{ background: C.card, borderRadius: 24, padding: '8px 10px 10px', border: `1px solid ${C.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: C.green, textTransform: 'uppercase' }}>{isCat ? t.vision.toUpperCase() : 'UCVA'}</div>
            <div style={{ width: '40%' }}>
              <EntryCell field="va" label={isCat ? "UCVA" : "UNITS"} color={getVAColor(String(eyeData.va))} val={eyeData.va} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'va'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 64px', columnGap: 6, rowGap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: ec.color, textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.refraction.toUpperCase()}</div>
            <EntryCell field="sph" label="SPH" color={ec.color} val={eyeData.sph} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="cyl" label="CYL" color={ec.color} val={eyeData.cyl} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="ax" label={t.axis.toUpperCase()} color={ec.color} val={eyeData.ax} isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>ASTIG. AXIS</div>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: `${C.surface}80`, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <AxisDial 
                  axis={parseInt(eyeData.ax || '0')} 
                  kAxis={parseInt(eyeData.k_ax || '0')}
                  pAxis={parseInt(preEye.k_ax || '0')}
                  size={54} color={ec.color} tickWidth={2} 
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr 1fr 1fr 40px', columnGap: 6, rowGap: 6, alignItems: 'center', marginTop: 6, borderTop: `1px solid ${C.border}30`, paddingTop: 6 }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>KERAT.</div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k1" label="K1" color={C.amber} val={eyeData.k1} onStartEdit={handleStartEdit} isEditing={editingField === 'k1'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k2" label="K2" color={C.amber} val={eyeData.k2} onStartEdit={handleStartEdit} isEditing={editingField === 'k2'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k_ax" label="KAX" color={C.amber} val={eyeData.k_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'k_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div />
          </div>

          <div style={{ marginTop: 8 }}>
            <textarea placeholder={t.clinicalNotes} value={eyeData.note || ''} onChange={e => setPeriodEyeField(activePeriod, resultEye, 'note', e.target.value)}
              style={{ width: '100%', minHeight: 40, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '6px 10px', color: C.text, fontFamily: F.sans, fontSize: 12, outline: 'none', resize: 'none' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 0 16px' }}>
        <button onClick={() => { haptic.notification('success'); onSave(); }} disabled={isSaving}
          style={{ width: '100%', background: isSaving ? C.surface : `linear-gradient(135deg, ${C.green} 0%, #10B981 100%)`, border: 'none', borderRadius: 18, padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: isSaving ? C.muted3 : '#fff', fontSize: 15, fontWeight: 900, boxShadow: isSaving ? 'none' : `0 8px 20px ${C.green}30`, cursor: 'pointer', transition: 'all 0.2s' }}>
          {isSaving ? t.loading : t.finishSave.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
