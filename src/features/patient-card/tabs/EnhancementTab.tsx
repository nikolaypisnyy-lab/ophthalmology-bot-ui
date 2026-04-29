import { useEffect, useState } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { EyeToggle, AutoRepeatButton } from '../../../ui';
import { CorneaSafetyCard } from '../../ablation/CorneaSafetyCard';
import { computeRefStats, rsbLevel } from '../../../calculators/refStats';

const EXCIMER_LIST = [
  { id: 'ex500', shortLabel: 'EX500', color: '#3b82f6' },
  { id: 'visx_s4ir', shortLabel: 'VISX', color: '#818cf8' },
  { id: 'mel90', shortLabel: 'MEL90', color: '#10b981' },
];

function EnhancementResult({ eye, laser, onReset }: any) {
  const { draft, refPlan, enhancementPlan, setEnhancementField, setDraft } = useSessionStore();
  const ec = eyeColors(eye);
  const plan = (enhancementPlan as any)?.[eye];
  const primaryPlan = (refPlan as any)?.[eye] || (draft as any)?.savedPlan?.[eye];

  // Always show the plan interface
  const safePlan = plan || { sph: 0, cyl: 0, ax: 0 };

  const updateEnhPower = (field: 'sph' | 'cyl' | 'ax', isPlus: boolean, step: number) => {
    const cur = (safePlan as any)[field] || 0;
    let next = cur;

    if (field === 'sph' || field === 'cyl') {
      if (cur < 0) {
        next = isPlus ? cur - step : cur + step;
      } else if (cur > 0) {
        next = isPlus ? cur + step : cur - step;
      } else {
        next = isPlus ? 0.25 : -0.25;
      }
      next = Math.round(next * 100) / 100;
      if (field === 'cyl' && next > 0) next = 0;
    } else if (field === 'ax') {
      next = isPlus ? cur + step : cur - step;
      if (next < 0) next = 180 + next;
      if (next >= 180) next = next - 180;
    }
    
    setEnhancementField(eye, field as any, next);
  };

  try {
    const eyeData = (draft as any)?.[eye] || { cct: '540', k1: '43.0', k2: '44.0', kavg: '43.5' };
    const oz = parseFloat(String((draft as any)?.oz || '6.5')) || 6.5;
    const currentCCT = parseFloat(String(eyeData.cct || '540')) || 540;
    const flapThickness = parseFloat(String((draft as any)?.capOrFlap || '110')) || 110;

    // Baseline surgery stats - ensuring safety if primary plan is missing
    const pSph = primaryPlan?.sph ?? 0;
    const pCyl = primaryPlan?.cyl ?? 0;
    const pStats = computeRefStats(
      pSph, pCyl, String(oz),
      false, currentCCT, String(flapThickness), '15',
      parseFloat(eyeData.k1) || 43, parseFloat(eyeData.k2) || 44, parseFloat(eyeData.kavg) || 43.5,
      laser as any
    ) || {};

    const primaryRSB = pStats.rsb ?? (currentCCT - flapThickness);
    const primaryK = pStats.kpost ?? (parseFloat(eyeData.kavg) || 43.5);

    // Enhancement stats
    const enhStats = computeRefStats(
      safePlan.sph || 0, safePlan.cyl || 0, String(oz), false,
      primaryRSB, 0, 0,
      primaryK, primaryK, primaryK,
      laser as any
    ) || {};

    const cumulativeAbl = (parseFloat(String(pStats.abl || 0))) + (parseFloat(String(enhStats.abl || 0)));
    const rsb = parseFloat(String(primaryRSB || 0)) - (parseFloat(String(enhStats.abl || 0)));
    const pta = currentCCT > 0 ? ((flapThickness + cumulativeAbl) / currentCCT) * 100 : 0;
    const fmtSE = (s: number, c: number) => (parseFloat(String(s || 0)) + parseFloat(String(c || 0))/2).toFixed(2);

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.card, borderRadius: 20, padding: '16px 12px', border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Enhancement Plan</span>
            <button onClick={onReset} style={{ width: 24, height: 24, borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, color: C.tertiary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
               <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 4, background: C.surface, padding: 2, borderRadius: 10 }}>
              {(['manifest', 'corneal', 'vector', 'wavefront'] as const).map(s => (
                <button key={s} onClick={() => setDraft({ enhAstigStrategy: s } as any)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: ((draft as any).enhAstigStrategy ?? 'manifest') === s ? C.cardHi : 'transparent', color: ((draft as any).enhAstigStrategy ?? 'manifest') === s ? C.primary : C.tertiary, fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'SPH', val: safePlan.sph || 0, step: 0.25, field: 'sph', fmt: (v:any)=> (parseFloat(v||0)>0?'+':'')+parseFloat(v||0).toFixed(2), color: ec.color },
              { label: 'CYL', val: safePlan.cyl || 0, step: 0.25, field: 'cyl', fmt: (v:any)=> parseFloat(v||0).toFixed(2), color: ec.color },
              { label: 'AXIS', val: safePlan.ax || 0,  step: 5,    field: 'ax',  fmt: (v:any)=> (v||0)+'°', color: C.primary },
            ].map((f:any) => (
              <div key={f.label} style={{ background: C.surface, borderRadius: 12, padding: '8px 4px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px 4px', borderBottom: `1px solid ${C.border}40`, marginBottom: 6 }}>
                  <AutoRepeatButton onTrigger={() => updateEnhPower(f.field, false, f.step)} style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 18, padding: '10px 14px', margin: '-10px -8px', cursor: 'pointer', outline: 'none' }}>−</AutoRepeatButton>
                  <div style={{ fontSize: 8, color: C.tertiary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
                  <AutoRepeatButton onTrigger={() => updateEnhPower(f.field, true, f.step)} style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 18, padding: '10px 14px', margin: '-10px -8px', cursor: 'pointer', outline: 'none' }}>+</AutoRepeatButton>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: f.color, fontFamily: F.mono, lineHeight: 1 }}>{f.fmt(f.val)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: `${C.indigo}10`, borderRadius: 12, border: `1px solid ${C.indigo}20`, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ fontSize: 8, color: C.indigo, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Ablation</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.primary, fontFamily: F.mono }}>{enhStats.abl || 0} μm</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: C.indigo, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cumulative</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.primary, fontFamily: F.mono }}>{cumulativeAbl} μm</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, padding: '4px 8px', borderRadius: 8, border: `1px solid ${(rsb || 0) < 300 ? C.red : C.green}40` }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: (rsb || 0) < 300 ? C.red : C.green }} />
                <span style={{ fontSize: 9, fontWeight: 800, color: (rsb || 0) < 300 ? C.red : C.green, letterSpacing: '0.04em' }}>{(rsb || 0) < 300 ? 'RECHECK' : 'SAFE'}</span>
            </div>
          </div>

          <div style={{ padding: '12px', background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Safety Profile (Enhancement)</span>
              <div style={{ background: (rsb || 0) < 300 ? C.red : C.green, width: 6, height: 6, borderRadius: '50%' }} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', marginBottom: 4 }}>Ablation</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, fontFamily: F.mono }}>{enhStats.abl || 0}<span style={{ fontSize: 8, marginLeft: 2, color: C.tertiary }}>μm</span></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', marginBottom: 4 }}>Resid. Stroma</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: (rsb || 0) < 300 ? C.red : C.green, fontFamily: F.mono }}>{(rsb || 0).toFixed(0)}<span style={{ fontSize: 8, marginLeft: 2, color: C.tertiary }}>μm</span></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.tertiary, textTransform: 'uppercase', marginBottom: 4 }}>PTA</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: (pta || 0) > 40 ? C.red : C.primary, fontFamily: F.mono }}>{(pta || 0).toFixed(1)}<span style={{ fontSize: 8, marginLeft: 2, color: C.tertiary }}>%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  } catch (err) {
    return <div style={{ color: C.red, fontSize: 11, padding: 20 }}>Calculation Error: {String(err)}</div>;
  }
}

export function EnhancementTab() {
  const { draft, setDraft, enhancementPlan, setEnhancementPlan, toggleSurgicalEye } = useSessionStore();
  const { enhancementEye, setEnhancementEye, openOCR } = useUIStore();

  if (!draft) return null;

  try {
    const ec = eyeColors(enhancementEye);
    const laser = draft.laser ?? 'ex500';
    const residualKey = `residual_${enhancementEye}` as any;
    const residual: any = (draft as any)[residualKey] ?? { sph: '', cyl: '', ax: '' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <EyeToggle value={enhancementEye} onChange={setEnhancementEye} onLongPress={toggleSurgicalEye} />
        </div>

        <div style={{ background: C.card, borderRadius: 20, padding: '16px 12px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: ec.color, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Residual Refraction</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'SPH', field: 'sph', step: 0.25, fmt: (v:any) => (parseFloat(v)>0?'+':'')+parseFloat(v||0).toFixed(2) },
              { label: 'CYL', field: 'cyl', step: 0.25, fmt: (v:any) => parseFloat(v||0).toFixed(2) },
              { label: 'AXIS', field: 'ax', step: 5, fmt: (v:any) => (v||0)+'°' },
            ].map(f => {
              const curVal = parseFloat(residual[f.field] || '0') || 0;
              const update = (delta: number) => {
                let next = curVal + delta;
                if (f.field === 'ax') {
                  if (next < 0) next = 180 + next;
                  if (next >= 180) next = next - 180;
                }
                setDraft({ [residualKey]: { ...residual, [f.field]: String(next) } });
              };

              return (
                <div key={f.label} style={{ background: C.surface, borderRadius: 12, padding: '8px 4px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px 6px', borderBottom: `1px solid ${C.border}40`, marginBottom: 8 }}>
                    <AutoRepeatButton onTrigger={() => update(-f.step)} style={{ background: 'none', border: 'none', color: C.muted2, fontSize: 18, padding: '10px 14px', margin: '-10px -8px', cursor: 'pointer', outline: 'none' }}>−</AutoRepeatButton>
                    <div style={{ fontSize: 7, color: C.muted2, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
                    <AutoRepeatButton onTrigger={() => update(f.step)} style={{ background: 'none', border: 'none', color: C.muted2, fontSize: 18, padding: '10px 14px', margin: '-10px -8px', cursor: 'pointer', outline: 'none' }}>+</AutoRepeatButton>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: f.label === 'AXIS' ? C.text : ec.color, fontFamily: F.mono, lineHeight: 1 }}>{f.fmt(curVal)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <EnhancementResult 
          eye={enhancementEye} 
          laser={laser} 
          onReset={() => setEnhancementPlan(null)} 
        />
        
        <div style={{ height: 40 }} />
      </div>
    );
  } catch (err) {
    return <div style={{ color: C.red, padding: 24 }}>Render Error: {String(err)}</div>;
  }
}
