import React, { useState, useRef, useEffect } from 'react';
import { C, F, R, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { PERIOD_KEYS, PERIOD_LABELS } from '../../../types/results';
import type { PeriodKey } from '../../../types/results';
import { EyeToggle, SectionLabel, WheelField, AxisDial } from '../../../ui';
import { useTelegram } from '../../../hooks/useTelegram';

// Reusable components from BioTab for consistency
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
              const showPlus = !isAx && !field.includes('va') && !field.includes('k') && n >= 0;
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
  field, color, val, isAx, label, onStartEdit, isEditing, tempValue, onTempChange, onFinish, inputRef, onStep 
}: any) => {
  const step = isAx ? 5 : (field.includes('va') ? 0.05 : 0.25);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
      {label && <div style={{ fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '2px 4px', border: `1px solid ${isEditing ? color : C.border}40` }}>
        <button onClick={(e) => { e.stopPropagation(); onStep(field, -1, step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 11, padding: '0 4px', cursor: 'pointer' }}>−</button>
        <div 
          onClick={() => onStartEdit(field, val)}
          style={{ flex: 1, textAlign: 'center', fontSize: 10, fontFamily: F.mono, fontWeight: 700, color: color, cursor: 'text' }}
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
                const showPlus = !field.includes('va') && !field.includes('k') && n >= 0;
                return (showPlus ? '+' : '') + n.toFixed(2);
              })()}
              {isAx && !isNaN(parseFloat(String(val))) && '°'}
            </>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onStep(field, 1, step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 11, padding: '0 4px', cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
};

// Comparison Row for Pre/Plan/Fact Table
function CompareRow({ label, pre, plan, result, unit = '', color }: {
  label: string;
  pre?: string | number;
  plan?: string | number;
  result?: string | number;
  unit?: string;
  color?: string;
}) {
  const fmt = (v: string | number | undefined, isPlan?: boolean) => {
    if (v === undefined || v === '' || v === null) return isPlan ? '' : '—';
    const n = parseFloat(String(v));
    if (isNaN(n)) return '—';
    if (label.startsWith('K')) return n.toFixed(2);
    if (label === 'VA') return n.toFixed(2);
    return n > 0 ? `+${n.toFixed(2)}` : n === 0 ? '0.00' : n.toFixed(2);
  };
  const fmtRaw = (v: string | number | undefined, isPlan?: boolean) => {
    if (v === undefined || v === '' || v === null) return isPlan ? '' : '—';
    return String(v);
  };
  const isNum = unit !== '°' && unit !== '';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 2, alignItems: 'center' }}>
      <span style={{ fontFamily: F.sans, fontSize: 8.5, fontWeight: 800, color: color || C.muted, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted2, textAlign: 'center' }}>{isNum ? fmt(pre) : fmtRaw(pre)}{pre !== undefined && pre !== '' && unit ? ` ${unit}` : ''}</span>
      <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.accent, textAlign: 'center' }}>{isNum ? fmt(plan, true) : fmtRaw(plan, true)}{plan !== undefined && plan !== '' && unit ? ` ${unit}` : ''}</span>
      <span style={{ fontFamily: F.mono, fontSize: 10.5, color: color || C.text, fontWeight: 600, textAlign: 'center' }}>{isNum ? fmt(result) : fmtRaw(result)}{result !== undefined && result !== '' && unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

// Helper for VA color coding
const getVAColor = (va?: string) => {
  const n = parseFloat(va ?? '');
  if (isNaN(n)) return C.text;
  if (n >= 0.9) return C.green;
  if (n >= 0.5) return C.amber;
  return C.red;
};

// Helper for SE calculation
function getSE(sph: any, cyl: any): string {
  const s = parseFloat(String(sph ?? '')) || 0;
  const c = parseFloat(String(cyl ?? '')) || 0;
  const se = s + c / 2;
  return (se >= 0 ? '+' : '') + se.toFixed(2);
}

// Helper for suboptimal outcome


export function ResultTab({ onSave, isSaving }: { onSave: () => void, isSaving: boolean }) {
  const { draft, setPeriodEyeField, iolResult, toricResults } = useSessionStore();
  const { 
    activePeriod, setActivePeriod, resultEye, setResultEye, 
    editingField, setEditingField, tempValue, setTempValue,
    setActiveTab, setEnhancementEye
  } = useUIStore();
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
    if (editingField) {
      set(editingField, tempValue);
    }
    setEditingField(null);
  };

  const handleStep = (field: string, dir: number, step: number) => {
    const val = (eyeData as any)[field];
    const cur = parseFloat(val || '0');
    let n = cur + (dir * step);
    const isAx = field.includes('ax');
    if (isAx) {
      if (n < 0) n = 180 + n;
      if (n >= 180) n = n - 180;
    }
    const nv = n.toFixed(isAx ? 0 : 2);
    const showPlus = !isAx && !field.includes('va') && !field.includes('k') && n >= 0;
    set(field, isAx ? nv : (n > 25 ? nv : (showPlus ? '+' : '') + nv));
    haptic.light();
  };

  // Comparison Data
  const preEye = draft[resultEye] || {};
  const planEye = draft.savedPlan?.[resultEye] as any;
  
  const preSph = preEye.man_sph || '';
  const preCyl = preEye.man_cyl || '';
  const preAx  = preEye.man_ax || '';
  const preK1  = preEye.k1 || '';
  const preK2  = preEye.k2 || '';
  const preKAx = preEye.kerax || '';
  const preVA  = preEye.uva || '';
  const preBCVA = preEye.bcva || '';

  // OU VA fields
  const odData = periodData['od'] ?? {};
  const osData = periodData['os'] ?? {};
  const hasEnhancement = !!(draft as any).savedEnhancement;

  const disabledEyes: ('od' | 'os')[] = [];
  const currentEye = (draft.eye || 'OU').toUpperCase();
  if (currentEye === 'OD') disabledEyes.push('os');
  if (currentEye === 'OS') disabledEyes.push('od');

  const handleLongPressEye = (eye: 'od' | 'os') => {
    useSessionStore.getState().toggleSurgicalEye(eye);
    const nextEye = (useSessionStore.getState().draft?.eye || 'OU').toUpperCase();
    if (nextEye === 'OD' && resultEye === 'os') setResultEye('od');
    if (nextEye === 'OS' && resultEye === 'od') setResultEye('os');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Eye Selector */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle 
          value={resultEye} 
          onChange={setResultEye} 
          disabledEyes={disabledEyes}
          onLongPress={handleLongPressEye}
        />
      </div>

      {/* CATARACT SURGICAL SUMMARY — Compact & Beautiful */}
      {isCat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel color={ec.color}>SURGICAL SUMMARY {resultEye.toUpperCase()}</SectionLabel>
          <div style={{
            background: `linear-gradient(145deg, ${C.surface} 0%, ${C.surface2} 100%)`, 
            border: `1px solid ${C.border}`,
            borderRadius: 24, padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column', gap: 14,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.03 }}>
               <svg width="100" height="100" viewBox="0 0 24 24" fill={ec.color}><path d="M12 2v20M2 12h20" /></svg>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: ec.color }} />
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Implanted IOL</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: C.text, lineHeight: 1.2 }}>{iolResult?.lens || 'LENS NOT SET'}</span>
                  {toricResults?.[resultEye]?.best_model && (
                    <span style={{ fontSize: 9, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', marginTop: 2 }}>
                      Toric Component: {toricResults[resultEye].best_model}
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ 
                background: `${ec.color}15`, borderRadius: 16, padding: '10px 16px', border: `1px solid ${ec.color}30`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70
              }}>
                <span style={{ fontSize: 7, fontWeight: 900, color: ec.color, textTransform: 'uppercase', marginBottom: 2 }}>Power</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: C.text, fontFamily: F.mono, letterSpacing: '-0.02em' }}>
                  {(() => {
                    const p = (iolResult as any)?.[resultEye]?.selectedPower;
                    if (p === undefined) return '—';
                    const num = typeof p === 'number' ? p : parseFloat(String(p));
                    return (num > 0 ? '+' : '') + num.toFixed(2);
                  })()}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
               <div style={{ background: C.bg, borderRadius: 18, padding: '12px', border: `1px solid ${C.border}60`, display: 'flex', alignItems: 'center', gap: 12 }}>
                 <div style={{ width: 36, height: 36, borderRadius: 12, background: `${C.green}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5">
                       <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                       <circle cx="12" cy="12" r="3" />
                    </svg>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>Vision</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: getVAColor(String(eyeData.va)), fontFamily: F.mono, lineHeight: 1 }}>{eyeData.va || '—'}</span>
                 </div>
               </div>
               
               <div style={{ background: C.bg, borderRadius: 18, padding: '12px', border: `1px solid ${C.border}60`, display: 'flex', alignItems: 'center', gap: 12 }}>
                 <div style={{ width: 36, height: 36, borderRadius: 12, background: `${C.amber}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2.5">
                       <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" />
                    </svg>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>SE</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: C.text, fontFamily: F.mono, lineHeight: 1 }}>
                      {getSE(eyeData.sph, eyeData.cyl)}
                    </span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD COMPARISON TABLE (Pre / Plan / Fact) — Hidden for Cataract as requested */}
      {!isCat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel color={ec.color}>COMPARISON {resultEye.toUpperCase()}</SectionLabel>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 24, padding: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }}>
            <div style={{ 
               background: C.surface, 
               borderRadius: 18, 
               padding: '12px 10px',
               display: 'flex', flexDirection: 'column', gap: 6,
               border: `1px solid ${C.border}40`
            }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 2, marginBottom: 4 }}>
                <span />
                {(['PRE', 'PLAN', 'FACT'] as const).map(h => (
                  <span key={h} style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 800, color: h === 'FACT' ? C.text : h === 'PLAN' ? C.accent : C.muted, textAlign: 'center', letterSpacing: '.05em', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              <CompareRow label="Sph" pre={preSph} plan={planEye?.sph} result={eyeData.sph} unit="D" />
              <CompareRow label="Cyl" pre={preCyl} plan={planEye?.cyl} result={eyeData.cyl} unit="D" />
              <CompareRow label="Ax" pre={preAx} plan={planEye?.ax} result={eyeData.ax} unit="°" />
              <CompareRow label="SE" pre={getSE(preSph, preCyl)} result={getSE(eyeData.sph, eyeData.cyl)} unit="D" color={C.green} />
              
              <div style={{ 
                height: '1px', 
                background: `linear-gradient(90deg, transparent 0%, ${C.border} 50%, transparent 100%)`, 
                opacity: 0.3,
                margin: '4px 0' 
              }} />
              
              <CompareRow label="K1" pre={preK1} result={eyeData.k1} unit="D" />
              <CompareRow label="K2" pre={preK2} result={eyeData.k2} unit="D" />
              <CompareRow label="VA" pre={preVA} result={eyeData.va} color={getVAColor(String(eyeData.va))} />
            </div>
          </div>
        </div>
      )}

      {/* Period Strip */}
      <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
        {PERIOD_KEYS.map(p => {
          const active = activePeriod === p;
          const hasDataEye = (e: any) => !!(e?.sph || e?.va || e?.bcva || e?.k1 || e?.k2 || e?.note || e?.cyl);
          const hasData = !!(hasDataEye(draft.periods?.[p]?.od) || hasDataEye(draft.periods?.[p]?.os));
          return (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              style={{
                flex: 1, padding: '6px 4px', borderRadius: 20,
                border: `1.5px solid ${active ? C.accent : hasData ? C.border2 : C.border}`,
                background: active ? C.accentLt : 'transparent',
                color: active ? C.accent : hasData ? C.muted2 : C.muted,
                fontFamily: F.sans, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                transition: 'all .15s',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              {PERIOD_LABELS[p]}
              {hasData && !active && (
                <span style={{
                  position: 'absolute', top: 3, right: 5,
                  width: 4, height: 4, borderRadius: '50%',
                  background: C.accent, opacity: 0.7,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN INPUT CARD (The Big Grid) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SectionLabel color={ec.color}>RESULT {resultEye.toUpperCase()} — {PERIOD_LABELS[activePeriod]}</SectionLabel>
        <div style={{ background: C.card, borderRadius: 24, padding: '12px 14px 10px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}>
          
          {/* VA Entry Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.04em', alignSelf: 'center' }}>{isCat ? 'VISION' : 'UCVA'}</div>
            <EntryCell field="va" label={isCat ? "UCVA" : "UNITS"} color={getVAColor(String(eyeData.va))} val={eyeData.va} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'va'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
          </div>

          {/* REFRACTION Inputs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr 1fr 1fr 50px', columnGap: 4, rowGap: 6, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: ec.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>REFRACT.</div>
            <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>SPH</div>
            <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>CYL</div>
            <div style={{ fontSize: 6.5, color: C.muted3, textAlign: 'center', fontWeight: 900 }}>AXIS</div>
            <div />

            <div style={{ height: 1 }} />
            <EntryCell field="sph" label="FACT-S" color={ec.color} val={eyeData.sph} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'sph'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="cyl" label="FACT-C" color={ec.color} val={eyeData.cyl} onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'cyl'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            <EntryCell field="ax" label="FACT-A" color={ec.color} val={eyeData.ax} isAx onStep={handleStep} onStartEdit={handleStartEdit} isEditing={editingField === 'ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
            
            {/* Magic Astigmatism Wheel - Replicating BioTab look */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AxisDial 
                  axis={parseInt(eyeData.ax || '0')} 
                  kAxis={parseInt(eyeData.k_ax || '0')} 
                  size={44} color={ec.color} tickWidth={1.0} 
                />
              </div>
            </div>
          </div>

          {/* Keratometry Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr 1fr 1fr 50px', columnGap: 4, rowGap: 8, alignItems: 'center', marginTop: 6, borderTop: `1px solid ${C.border}40`, paddingTop: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.04em' }}>KERAT.</div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k1" label="K1" color={C.amber} val={eyeData.k1} onStartEdit={handleStartEdit} isEditing={editingField === 'k1'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k2" label="K2" color={C.amber} val={eyeData.k2} onStartEdit={handleStartEdit} isEditing={editingField === 'k2'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div style={{ textAlign: 'center' }}><CompactInput field="k_ax" label="KAX" color={C.amber} val={eyeData.k_ax} isAx onStartEdit={handleStartEdit} isEditing={editingField === 'k_ax'} tempValue={tempValue} onTempChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} onStep={handleStep} /></div>
            <div />
          </div>

          {/* Clinical Note */}
          <div style={{ marginTop: 10 }}>
            <textarea 
              placeholder="Clinical Notes..."
              value={eyeData.note || ''}
              onChange={e => {
                  const v = e.target.value;
                  setPeriodEyeField(activePeriod, resultEye, 'note', v);
              }}
              style={{
                width: '100%', minHeight: 48, background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '8px 12px', color: C.text, fontFamily: F.sans, fontSize: 13,
                outline: 'none', resize: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Period History Summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionLabel>HISTORY OF RESULTS</SectionLabel>
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 24, padding: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
        }}>
          <div style={{ 
             background: C.surface, 
             borderRadius: 18, 
             padding: '12px 10px',
             display: 'flex', flexDirection: 'column', gap: 6,
             border: `1px solid ${C.border}40`
          }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 136px', gap: 10, marginBottom: 4, padding: '0 4px' }}>
              <span style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 800, color: C.muted, letterSpacing: '.05em', textTransform: 'uppercase' }}>PERIOD</span>
              <span style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 800, color: C.muted, textAlign: 'center', letterSpacing: '.05em', textTransform: 'uppercase' }}>VA</span>
              <span style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 800, color: C.muted, textAlign: 'center', letterSpacing: '.05em', textTransform: 'uppercase' }}>REFRACTION</span>
            </div>

            {PERIOD_KEYS.map((pk, idx) => {
              const pd = draft.periods?.[pk]?.[resultEye];
              if (!pd?.sph && !pd?.va && !pd?.bcva && !pd?.k1 && !pd?.k2 && !pd?.note && !pd?.cyl) return null;
              
              const sph = parseFloat(pd.sph ?? '');
              const active = activePeriod === pk;

              return (
                <div
                  key={pk}
                  onClick={() => { setActivePeriod(pk); haptic.impact('light'); }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 36px 136px', gap: 10, alignItems: 'center',
                    padding: '8px 4px', cursor: 'pointer',
                    background: active ? C.accentLt : 'transparent',
                    borderRadius: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: F.sans, fontSize: 10.5, fontWeight: active ? 800 : 600, color: active ? C.accent : C.text, textTransform: 'uppercase' }}>
                      {PERIOD_LABELS[pk]}
                    </span>
                  </div>

                  <span style={{ fontFamily: F.mono, fontSize: 11, color: getVAColor(pd.va), fontWeight: 700, textAlign: 'center' }}>
                    {pd.va || '—'}
                  </span>

                  <span style={{ fontFamily: F.mono, fontSize: 11, color: active ? C.accent : C.muted2, fontWeight: 600, textAlign: 'center' }}>
                    {!isNaN(sph) ? (sph >= 0 ? '+' : '') + sph.toFixed(2) : '—'}
                    {pd.cyl && ` ${parseFloat(pd.cyl) >= 0 ? '+' : ''}${parseFloat(pd.cyl).toFixed(2)}`}
                    {pd.ax && ` ${Math.round(parseFloat(pd.ax))}°`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div style={{ padding: '24px 0 10px' }}>
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            width: '100%', background: `linear-gradient(135deg, ${C.green} 0%, #10B981 100%)`,
            border: 'none', borderRadius: 20, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            color: '#fff', fontFamily: F.sans, fontSize: 15, fontWeight: 800,
            boxShadow: `0 8px 16px ${C.green}30`, cursor: 'pointer', opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? 'SAVING...' : 'FINISH & SAVE'}
        </button>
      </div>

    </div>
  );
}
