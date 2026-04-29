import { useEffect, useRef } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { SectionLabel, AxisDial } from '../../../ui';
import { CorneaSafetyCard } from '../../ablation/CorneaSafetyCard';
import { useTelegram } from '../../../hooks/useTelegram';
import { computeRefPlan } from '../../../calculators/refraction';
import { T } from '../../../constants/translations';
import type { LaserType } from '../../../types/refraction';

const safeAx = (val: any) => {
  const a = parseInt(String(val));
  return isNaN(a) ? 0 : a;
};

const SectionHeader = ({ title }: { title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 4px 2px' }}>
    <span style={{ fontSize: 9, fontWeight: 900, color: C.indigo, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</span>
    <div style={{ flex: 1, height: 1, background: C.border, opacity: 0.2 }} />
  </div>
);

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

export function RefractionPlanTab() {
  const { draft, setDraft, refPlan, setPlanField, planTweaked, isRounding, toggleRounding } = useSessionStore();
  const { planEye, editingField, setEditingField, tempValue, setTempValue } = useUIStore();
  const { language } = useClinicStore();
  const { haptic } = useTelegram();
  const t = T(language);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  useEffect(() => {
    if (!draft || planTweaked) return;
    const data = draft[planEye];
    if (!data) return;
    const laser = (draft.laser || 'ex500') as LaserType;
    const strategy = data.astigStrategy || draft.astigStrategy || 'manifest';
    let age = 40;
    if (draft.age) age = parseInt(draft.age);

    const calculatedPlan = computeRefPlan(data, laser, false, isRounding, age, !!draft.noNomogram, strategy);
    if (calculatedPlan) {
      const { autoSetPlan } = useSessionStore.getState();
      autoSetPlan(planEye, { 
        sph: calculatedPlan.sph, 
        cyl: calculatedPlan.cyl, 
        ax: calculatedPlan.ax,
        oz: 6.5,
        flap: 110
      });
    }
  }, [draft?.laser, draft?.od?.astigStrategy, draft?.os?.astigStrategy, draft?.astigStrategy, planEye, draft?.od?.man_sph, draft?.os?.man_sph, draft?.od?.man_cyl, draft?.os?.man_cyl, planTweaked, isRounding]);

  if (!draft) return null;

  const ec = eyeColors(planEye);
  const data = draft[planEye] || {};
  const plan = (refPlan as any)?.[planEye] || { sph: 0, cyl: 0, ax: 0, oz: 6.5, flap: 110 };
  
  const diopters = Math.abs((plan.sph || 0) + (plan.cyl || 0) / 2);
  const oz = plan.oz || 6.5;
  const abl = Math.max(0, Math.round((Math.pow(oz, 2) * diopters) / 3));
  const flap = plan.flap ?? 110;
  const isPRK = flap === 0;
  const effectiveFlap = isPRK ? 60 : flap; // PRK epithelium is 60µm
  const cct = parseFloat(data.cct) || 540;
  const rsb = cct - effectiveFlap - abl;
  const pta = Math.round(((effectiveFlap + abl) / cct) * 100);
  const kpre = parseFloat(data.kavg) || 43.5;
  const kpost = kpre - diopters;

  const fmt = (v: any) => { 
    const n = parseFloat(String(v)); 
    if (isNaN(n)) return '—'; 
    return (n > 0 ? '+' : '') + n.toFixed(2); 
  };

  const updatePower = (field: string, isPlus: boolean, step: number) => {
    const latestPlan = (useSessionStore.getState().refPlan as any)?.[planEye] || { sph: 0, cyl: 0, ax: 0, oz: 6.5, flap: 110 };
    const cur = (latestPlan as any)[field] || 0;
    let next = cur;
    if (field === 'sph' || field === 'cyl') {
      next = isPlus ? cur + step : cur - step;
      next = Math.round(next * 100) / 100; 
      if (field === 'cyl' && next > 0) next = 0;
    } else if (field === 'ax') {
      next = isPlus ? cur + step : cur - step; 
      if (next < 0) next = 180 + next; 
      if (next >= 180) next = next - 180;
    } else if (field === 'oz') {
      next = isPlus ? cur + step : cur - step; 
      next = Math.max(4.0, Math.min(8.0, Math.round(next * 10) / 10));
    }
    setPlanField(planEye, field as any, next);
    haptic.selection();
  };

  const handleStartEdit = (field: string, val: any) => {
    setTempValue(String(val || ''));
    setEditingField(field);
  };

  const handleFinishEdit = () => {
    if (editingField) {
      let v = parseFloat(tempValue) || 0;
      if (editingField === 'ax') { 
        v = safeAx(tempValue); 
        if (v < 0) v = 180 + v; 
        if (v >= 180) v = v - 180; 
      }
      setPlanField(planEye, editingField as any, v);
    }
    setEditingField(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title={t.diagnostics} />
      <div style={{ background: C.card, borderRadius: 28, padding: '8px 10px', border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ background: `${C.surface}80`, borderRadius: 22, padding: '12px 14px', border: `1px solid ${C.border}40` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${C.border}20`, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>BCVA</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: C.green, fontFamily: F.mono }}>
                {(() => {
                  const v = parseFloat(String(data.bcva || '1.0'));
                  return isNaN(v) ? '1.0' : v.toFixed(1);
                })()}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: ec.color, fontFamily: F.mono, letterSpacing: '-0.02em' }}>
                {fmt(data.man_sph)} / {fmt(data.man_cyl)} × {data.man_ax || '0'}°
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.bg, border: `1px solid ${C.border}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AxisDial 
                  axis={safeAx(data.man_ax)} 
                  kAxis={safeAx(data.k_ax)}
                  pAxis={safeAx(data.p_tot_a)}
                  size={22} color={ec.color} tickWidth={1.5} 
                />
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 8, paddingLeft: 4, marginBottom: 4 }}>
              <div />
              <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textAlign: 'center', letterSpacing: '0.06em' }}>SPH</div>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textAlign: 'center', letterSpacing: '0.06em' }}>CYL</div>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textAlign: 'center', letterSpacing: '0.06em' }}>AXIS</div>
            </div>

            <DiagRow 
              label={t.narrow.toUpperCase()} sph={data.n_sph} cyl={data.n_cyl} ax={data.n_ax} color={C.indigo} 
              kAx={safeAx(data.k_ax)} pAx={safeAx(data.p_tot_a)} 
            />
            <DiagRow 
              label={t.wide.toUpperCase()} sph={data.c_sph} cyl={data.c_cyl} ax={data.c_ax} color={C.muted2} 
              kAx={safeAx(data.k_ax)} pAx={safeAx(data.p_tot_a)} 
            />
            <DiagRow 
              label="CORNEAL K" sph={data.k1} cyl={data.k2} ax={data.k_ax} color={C.amber} 
              kAx={safeAx(data.k_ax)} pAx={safeAx(data.p_tot_a)} isK 
            />
          </div>
        </div>
      </div>

      <SectionHeader title={t.laserParams} />
      <div style={{ background: C.card, borderRadius: 24, padding: '16px 12px', border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: C.surface, padding: '2px', borderRadius: 14, border: `1px solid ${C.border}60`, marginBottom: 14 }}>
          <div style={{ display: 'flex', flex: 1 }}>
            {(['manifest', 'corneal', 'vector', 'wavefront'] as const).map(s => {
              const currentStrategy = data.astigStrategy || draft.astigStrategy || 'manifest';
              const active = currentStrategy === s;
              return (
                <button key={s} onClick={() => { haptic.selection(); setDraft({ [planEye]: { ...data, astigStrategy: s } } as any); useSessionStore.getState().setPlanTweaked(false); }}
                  style={{ flex: 1, padding: '4px 0', borderRadius: 10, border: 'none', background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: active ? C.text : C.muted2, fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.04em' }}>{s}</button>
              );
            })}
          </div>
          <div style={{ width: 1, height: 12, background: C.border, margin: '0 4px', opacity: 0.5 }} />
          <button onClick={() => { haptic.selection(); toggleRounding(); }}
            style={{ padding: '2px 12px', borderRadius: 10, border: 'none', background: isRounding ? `${C.green}20` : 'transparent', color: isRounding ? C.green : C.muted2, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: isRounding ? C.green : C.muted3 }} />
            <span style={{ fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>0.25 Step</span>
          </button>
        </div>

        {data.plan_sph && (
          <button 
            onClick={() => {
              haptic.notification('success');
              const { autoSetPlan } = useSessionStore.getState();
              autoSetPlan(planEye, { 
                sph: parseFloat(data.plan_sph) || 0, 
                cyl: parseFloat(data.plan_cyl) || 0, 
                ax: parseInt(data.plan_ax) || 0,
                oz: 6.5,
                flap: 110
              });
            }}
            style={{ 
              width: '100%', marginBottom: 12, padding: '8px', borderRadius: 12,
              background: `${C.green}15`, border: `1px solid ${C.green}40`,
              color: C.green, fontSize: 10, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {t.copyFromReport.toUpperCase()} ({data.plan_sph}/{data.plan_cyl}/{data.plan_ax})
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <PlanCell label="SPH" value={plan.sph} step={0.25} field="sph" fmt={fmt} color={ec.color} onUpdate={updatePower} onEdit={handleStartEdit} editing={editingField === 'sph'} temp={tempValue} onChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
          <PlanCell label="CYL" value={plan.cyl} step={0.25} field="cyl" fmt={(v:any)=> parseFloat(v||0).toFixed(2)} color={ec.color} onUpdate={updatePower} onEdit={handleStartEdit} editing={editingField === 'cyl'} temp={tempValue} onChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
          <PlanCell label={t.axis} value={plan.ax} step={5} field="ax" fmt={(v:any)=> (v||0)} color={ec.color} unit="°" onUpdate={updatePower} onEdit={handleStartEdit} editing={editingField === 'ax'} temp={tempValue} onChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
          <PlanCell label="OZ" value={plan.oz} step={0.1} field="oz" fmt={(v:any)=> parseFloat(v||0).toFixed(1)} color={C.indigo} unit="mm" onUpdate={updatePower} onEdit={handleStartEdit} editing={editingField === 'oz'} temp={tempValue} onChange={setTempValue} onFinish={handleFinishEdit} inputRef={inputRef} />
        </div>
      </div>

      <SectionHeader title={t.ablationProfile} />
      <CorneaSafetyCard 
        eye={planEye} cct={cct} flap={flap} abl={abl} rsb={rsb} pta={pta} kpost={kpost} kpre={kpre} 
        isPRK={isPRK} effectiveFlap={effectiveFlap} 
      />

      <SectionHeader title="FLAP & TECHNIQUE" />
      <div style={{ background: C.card, borderRadius: 24, padding: '8px 14px 6px', border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: '6px 12px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.08em' }}>DIAM</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <AutoRepeatButton onTrigger={() => { haptic.selection(); const next = Math.max(7.0, (parseFloat(data.flap_diam || '8.5') - 0.1)); set('flap_diam', next.toFixed(1)); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -10px', cursor: 'pointer' }}>−</AutoRepeatButton>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: F.mono }}>{data.flap_diam || '8.5'}<span style={{ fontSize: 9, color: C.muted3, marginLeft: 2, fontWeight: 800 }}>mm</span></div>
              <AutoRepeatButton onTrigger={() => { haptic.selection(); const next = Math.min(9.5, (parseFloat(data.flap_diam || '8.5') + 0.1)); set('flap_diam', next.toFixed(1)); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -10px', cursor: 'pointer' }}>+</AutoRepeatButton>
            </div>
          </div>
          <div style={{ background: C.surface, borderRadius: 16, padding: '6px 12px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.08em' }}>POS</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <AutoRepeatButton onTrigger={() => { haptic.selection(); let next = (parseInt(data.flap_pos || '90') - 5); if (next < 0) next += 360; set('flap_pos', next.toString()); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -10px', cursor: 'pointer' }}>−</AutoRepeatButton>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                {data.flap_pos || '90'}
                <span style={{ fontSize: 10, color: C.muted3, verticalAlign: 'super', lineHeight: 0, fontWeight: 900 }}>°</span>
              </div>
              <AutoRepeatButton onTrigger={() => { haptic.selection(); let next = (parseInt(data.flap_pos || '90') + 5) % 360; set('flap_pos', next.toString()); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -10px', cursor: 'pointer' }}>+</AutoRepeatButton>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, display: 'flex', background: C.surface, padding: 2, borderRadius: 14, border: `1px solid ${C.border}` }}>
            {(['FEMTO', 'MECH'] as const).map(t => {
              const active = (data.tech || 'FEMTO') === t;
              return (
                <button key={t} onClick={() => { haptic.selection(); set('tech', t); }}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 12, border: 'none', background: active ? `${C.indigo}20` : 'transparent', color: active ? C.indigo : C.muted3, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}>{t}</button>
              );
            })}
          </div>
          <button onClick={() => { haptic.selection(); set('hinge', data.hinge === 'SUP' ? 'NAS' : 'SUP'); }}
            style={{ padding: '0 14px', borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface, color: C.indigo, fontSize: 9, fontWeight: 900, letterSpacing: '0.04em' }}>{data.hinge || 'SUP'}</button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {['90', '100', '110', 'PRK'].map(v => {
            const active = (plan.flap === 0 && v === 'PRK') || (plan.flap?.toString() === v);
            return (
              <button key={v} onClick={() => { haptic.selection(); setPlanField(planEye, 'flap', v === 'PRK' ? 0 : parseInt(v)); }}
                style={{ 
                  flex: 1, padding: '6px 0', borderRadius: 14, 
                  border: `1px solid ${active ? C.indigo : C.border}`, 
                  background: active ? `${C.indigo}15` : C.surface, 
                  color: active ? C.indigo : C.muted2, fontSize: 10, fontWeight: 900, transition: 'all 0.2s' 
                }}>{v}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DiagRow({ label, sph, cyl, ax, color, isK }: any) {
  const fmt = (v: any) => { 
    const n = parseFloat(String(v)); 
    if (isNaN(n)) return '—'; 
    return (n > 0 ? '+' : '') + n.toFixed(2); 
  };
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${C.border}20` }}>
      <div style={{ fontSize: 8.5, fontWeight: 900, color: color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: color, textAlign: 'center', fontFamily: F.mono }}>{isK ? (sph || '—') : fmt(sph)}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: color, textAlign: 'center', fontFamily: F.mono }}>{isK ? (cyl ? `-${Math.abs(sph-cyl).toFixed(2)}` : '—') : fmt(cyl)}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: color, textAlign: 'center', fontFamily: F.mono }}>{ax || '0'}°</div>
    </div>
  );
}

function PlanCell({ label, value, step, field, fmt, color, unit, onUpdate, onEdit, editing, temp, onChange, onFinish, inputRef }: any) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, padding: '4px 0 8px', border: `1px solid ${C.border}60`, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 3px', borderBottom: `1px solid ${C.border}30`, marginBottom: 3 }}>
        <AutoRepeatButton onTrigger={() => onUpdate(field, false, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -6px', cursor: 'pointer' }}>−</AutoRepeatButton>
        <span style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <AutoRepeatButton onTrigger={() => onUpdate(field, true, step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 10px', margin: '-4px -6px', cursor: 'pointer' }}>+</AutoRepeatButton>
      </div>
      <div onClick={() => onEdit(field, value)} style={{ fontSize: 18, fontWeight: 900, color: color, fontFamily: F.mono, minHeight: 22 }}>
        {editing ? (
          <input ref={inputRef} autoFocus value={temp} onChange={e => onChange(e.target.value)} onBlur={onFinish} onKeyDown={e => e.key === 'Enter' && onFinish()}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: color, fontSize: 18, fontWeight: 900, fontFamily: F.mono, outline: 'none' }} />
        ) : (
          <>{fmt(value)}{unit}</>
        )}
      </div>
    </div>
  );
}
