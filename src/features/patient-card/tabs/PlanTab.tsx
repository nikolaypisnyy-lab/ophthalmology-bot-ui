import { useEffect, useState, useRef } from 'react';
import { C, F, R, eyeColors } from '../../../constants/design';
import { Calendar } from '../../../ui/Calendar';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { EyeToggle } from '../../../ui/EyeToggle';
import { SectionLabel, Divider, AxisDial } from '../../../ui';
import { ToricSchematic } from '../../../ui/ToricSchematic';
import { newEyeData } from '../../../types/refraction';
import { CorneaSafetyCard } from '../../ablation/CorneaSafetyCard';
import { useTelegram } from '../../../hooks/useTelegram';
import { calcEx500 } from '../../../calculators/ex500';
import { getNomogramTarget } from '../../../calculators/nomogram';

const safeAx = (val: any) => {
  const a = parseInt(String(val));
  return isNaN(a) ? 0 : a;
};

const SectionHeader = ({ title }: { title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 4px 6px' }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: C.tertiary || C.secondary, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</span>
    <div style={{ flex: 1, height: 1, background: C.border, opacity: 0.4 }} />
  </div>
);


function CataractPlanTab() {
  const { draft, iolResult, toricResults } = useSessionStore();
  const { planEye } = useUIStore();
  if (!draft) return null;
  const ec = eyeColors(planEye);
  const r = (iolResult as any)?.[planEye];
  const eyeData = (draft[planEye] as any) || {};

  // incAx — ось разреза (BioTab сохраняет в draft.incAx)
  const incisionAx = parseInt((draft as any).incAx ?? draft.siaAx ?? '90') || 90;
  const hasPentacam = !!(eyeData.p_tot_c || eyeData.p_tot_k);
  const k1 = parseFloat(eyeData.k1 || '0');
  const k2 = parseFloat(eyeData.k2 || '0');
  const k1Ax = parseFloat(eyeData.k_ax || '0');
  const steepAx = hasPentacam ? (parseFloat(eyeData.p_tot_a) || 0) : (k2 > k1 ? (k1Ax + 90) % 180 : k1Ax);

  const toricOn = !!(draft as any).toricMode;
  const toric = toricResults?.[planEye];
  const toricAx = toric?.total_steep_axis ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* TORIC STATUS ROW — всегда виден */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: toricOn ? `${C.amber}12` : C.surface, borderRadius: 14, border: `1px solid ${toricOn ? C.amber + '40' : C.border}` }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: toricOn ? C.amber : C.muted3, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 900, color: toricOn ? C.amber : C.muted3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Toric IOL {toricOn ? 'ON' : 'OFF'}
        </span>
        {toricOn && toric && (
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 900, color: C.amber, fontFamily: F.mono }}>
            SN6A{toric.best_model}
          </span>
        )}
        {toricOn && !toric && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: C.muted3 }}>BIO → CALC</span>
        )}
      </div>

      {/* СХЕМА ИМПЛАНТАЦИИ — только при включённой торике */}
      {toricOn && (
        <div style={{
          background: C.card, borderRadius: 28, padding: '24px 16px', border: `1px solid ${C.border}`,
          boxShadow: '0 12px 48px rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${C.amber}, ${ec.color})` }} />

          <SectionLabel color={C.amber} style={{ marginBottom: 20, textAlign: 'center', fontSize: 10, letterSpacing: '0.15em' }}>
            TORIC IOL · IMPLANTATION PLANE
          </SectionLabel>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <ToricSchematic
              eye={planEye}
              incisionAx={incisionAx}
              toricAx={toricAx}
              steepAx={steepAx}
              size={240}
            />
          </div>

          {/* Axis legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div style={{ background: `${C.indigo}15`, padding: '8px', borderRadius: 12, border: `1px solid ${C.indigo}30`, textAlign: 'center' }}>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', marginBottom: 2 }}>INCISION</div>
              <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 800, color: C.text }}>{incisionAx}°</div>
            </div>
            <div style={{ background: `${C.red}10`, padding: '8px', borderRadius: 12, border: `1px solid ${C.red}20`, textAlign: 'center' }}>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.red, textTransform: 'uppercase', marginBottom: 2 }}>STEEP K</div>
              <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 800, color: C.text }}>{Math.round(steepAx)}°</div>
            </div>
            <div style={{ background: `${C.amber}15`, padding: '8px', borderRadius: 12, border: `1px solid ${C.amber}30`, textAlign: 'center' }}>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.amber, textTransform: 'uppercase', marginBottom: 2 }}>IOL AXIS</div>
              <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 800, color: C.text }}>
                {toricAx != null ? `${Math.round(toricAx)}°` : '—'}
              </div>
            </div>
          </div>

          {toric ? (() => {
            const best = toric.table?.find((s: any) => s.model === toric.best_model);
            const cylIol  = best?.cyl_iol  ?? null;
            const residual = best?.residual ?? null;
            const resAxis  = best?.res_axis ?? null;
            const implantAxis = toric.total_steep_axis ?? null;
            const iolPower = r?.selectedPower ?? parseFloat((iolResult as any)?.power) ?? null;
            const residualOk = residual != null && residual < 0.5;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Prescription строка */}
                <div style={{
                  background: `${C.amber}10`, borderRadius: 16, padding: '14px 16px',
                  border: `1px solid ${C.amber}30`,
                }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Toric IOL Prescription
                  </div>
                  {/* Строка 1: модель + цилиндр */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: F.mono, fontSize: 20, fontWeight: 900, color: C.text }}>
                      SN6A{toric.best_model || '—'}
                    </span>
                    {cylIol != null && (
                      <>
                        <span style={{ fontSize: 12, color: C.muted3 }}>cyl</span>
                        <span style={{ fontFamily: F.mono, fontSize: 20, fontWeight: 900, color: C.amber }}>
                          +{cylIol.toFixed(2)}D
                        </span>
                      </>
                    )}
                    {implantAxis != null && (
                      <>
                        <span style={{ fontSize: 12, color: C.muted3 }}>@</span>
                        <span style={{ fontFamily: F.mono, fontSize: 20, fontWeight: 900, color: C.text }}>
                          {Math.round(implantAxis)}°
                        </span>
                      </>
                    )}
                  </div>
                  {/* Строка 2: остаточный астигматизм */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 8, fontWeight: 900, color: residualOk ? C.green : C.amber, textTransform: 'uppercase' }}>
                      Residual:
                    </span>
                    {residual != null ? (
                      <>
                        <span style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 800, color: residualOk ? C.green : C.amber }}>
                          {residual < 0.01 ? '0.00' : `-${residual.toFixed(2)}`}D
                        </span>
                        {resAxis != null && (
                          <>
                            <span style={{ fontSize: 11, color: C.muted3 }}>@</span>
                            <span style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 800, color: residualOk ? C.green : C.amber }}>
                              {Math.round(resAxis)}°
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span style={{ fontFamily: F.mono, fontSize: 15, color: C.muted3 }}>—</span>
                    )}
                  </div>
                </div>

                {/* Детали расчёта */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[
                    { label: 'NET K CYL', val: toric.net_corneal_cyl != null ? `${toric.net_corneal_cyl.toFixed(2)}D` : '—', color: C.muted2 },
                    { label: 'ADJ CYL', val: toric.total_corneal_cyl_adj != null ? `${toric.total_corneal_cyl_adj.toFixed(2)}D` : '—', color: C.indigo },
                    { label: 'IMPL AXIS', val: implantAxis != null ? `${Math.round(implantAxis)}°` : '—', color: C.amber },
                    { label: 'RESIDUAL', val: residual != null ? `${residual.toFixed(2)}D` : '—', color: residualOk ? C.green : C.amber },
                  ].map(l => (
                    <div key={l.label} style={{ background: C.surface, borderRadius: 10, padding: '8px 4px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{l.label}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 800, color: l.color }}>{l.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : (
            <div style={{ padding: '12px', background: C.surface, borderRadius: 16, border: `1px dashed ${C.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: C.muted3, fontWeight: 700 }}>BIO → CALC чтобы рассчитать торическую ИОЛ</div>
            </div>
          )}
        </div>
      )}

      {/* LENS SUMMARY — всегда */}
      <div style={{
        background: C.card, borderRadius: 28, padding: '20px 16px', border: `1px solid ${C.border}`,
        boxShadow: '0 12px 48px rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${ec.color}, ${C.indigo})` }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>SELECTED MODEL</div>
            <div style={{ fontFamily: F.sans, fontSize: 18, fontWeight: 900, color: C.text, lineHeight: 1.2 }}>{(iolResult as any)?.lens || draft.iolResult?.lens || 'SELECT MODEL IN IOL TAB'}</div>
          </div>
          <div style={{ textAlign: 'right', marginLeft: 12 }}>
            <div style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 900, color: ec.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>POWER</div>
            <div style={{ fontFamily: F.mono, fontSize: 28, fontWeight: 900, color: ec.color }}>
              {r?.selectedPower ? r.selectedPower.toFixed(2) : ((iolResult as any)?.power || draft.iolResult?.power || '—')}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'TARGET', val: draft.targetRefr || '0.00', color: ec.color },
            { label: 'SIA', val: draft.sia || '0.10', color: C.indigo },
            { label: 'PRED. SE', val: r?.expectedRefr != null ? (r.expectedRefr > 0 ? '+' : '') + r.expectedRefr.toFixed(2) : '—', color: C.green },
          ].map(l => (
            <div key={l.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '10px 4px', border: `1px solid ${C.border}40`, textAlign: 'center' }}>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{l.label}</div>
              <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: l.color }}>{l.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RefractionPlanTab() {
  const { draft, setDraft, refPlan, setPlanField, planTweaked, isRounding, toggleRounding } = useSessionStore();
  const { planEye, editingField, setEditingField, tempValue, setTempValue } = useUIStore();
  const { activeRefNomo, activeRefNomoCyl } = useClinicStore();
  const { haptic } = useTelegram();
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const planEyeRef = useRef(planEye);
  useEffect(() => {
    if (planEye !== planEyeRef.current) {
      if (editingField) {
        let v = parseFloat(tempValue) || 0;
        if (editingField === 'ax') { 
          v = parseFloat(tempValue) || 0; 
          if (v < 0) v = 180 + v; 
          if (v >= 180) v = v - 180; 
        }
        setPlanField(planEyeRef.current, editingField as any, v);
        setEditingField(null);
      }
      planEyeRef.current = planEye;
    }
  }, [planEye, editingField, tempValue, setPlanField, setEditingField]);

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

  useEffect(() => {
    if (!draft || planTweaked) return;
    const data = draft[planEye] || newEyeData();
    const strategy = data.astigStrategy || draft.astigStrategy || 'manifest';
    let bSph = parseFloat(data.man_sph) || 0;
    let bCyl = parseFloat(data.man_cyl) || 0;
    let bAx = safeAx(data.man_ax);

    if (strategy === 'wavefront' || strategy === 'vector') { 
      bSph = parseFloat(data.w_sph) || 0; bCyl = parseFloat(data.w_cyl) || 0; bAx = safeAx(data.w_ax); 
    } else if (strategy === 'corneal') { 
      bSph = parseFloat(data.n_sph) || 0; bCyl = parseFloat(data.n_cyl) || 0; bAx = safeAx(data.n_ax); 
    }

    let age = 40;
    if (draft.birthDate) {
      const b = new Date(draft.birthDate);
      const n = new Date();
      age = n.getFullYear() - b.getFullYear();
      if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
    }

    const laser = String(draft.laser).toLowerCase();
    let targetSph = bSph;
    let targetCyl = bCyl;

    if (laser.includes('ex500') || laser.includes('alcon')) {
      const res = calcEx500(bSph, bCyl, age);
      targetSph = res.sph;
      targetCyl = res.cyl;
    } else {
      try {
        targetSph = getNomogramTarget(age, bSph);
        if (laser.includes('317') || laser.includes('technolas')) targetSph += 0.25;
        if (laser.includes('visx')) targetSph -= 0.25;
      } catch(e) {}
    }

    // Apply Clinical Nomogram Correction (selected in Results -> Auto-Nomogram)
    if (activeRefNomo) targetSph += activeRefNomo;
    if (activeRefNomoCyl) targetCyl += activeRefNomoCyl;

    const finalSph = Math.round(targetSph * 100) / 100;
    const finalCyl = Math.round(targetCyl * 100) / 100;
    const currentPlan = refPlan?.[planEye];
    const needsUpdate = !currentPlan || (currentPlan.sph !== finalSph || currentPlan.cyl !== finalCyl || currentPlan.ax !== bAx);

    if (needsUpdate) {
      const { autoSetPlan } = useSessionStore.getState();
      let s = finalSph;
      let c = finalCyl;
      if (isRounding) {
        s = Math.round(s * 4) / 4;
        c = Math.round(c * 4) / 4;
      }
      autoSetPlan(planEye, { sph: s, cyl: c, ax: bAx });
    }
  }, [draft?.laser, draft?.od?.astigStrategy, draft?.os?.astigStrategy, draft?.astigStrategy, planEye, draft?.od?.man_sph, draft?.os?.man_sph, draft?.od?.man_cyl, draft?.os?.man_cyl, planTweaked, isRounding, activeRefNomo, activeRefNomoCyl]);

  if (!draft) return null;

  const ec = eyeColors(planEye);
  const data = draft?.[planEye] ?? newEyeData();
  const rawPlan = (refPlan as any)?.[planEye];
  const plan = {
    sph: parseFloat(rawPlan?.sph ?? data.man_sph ?? 0) || 0,
    cyl: parseFloat(rawPlan?.cyl ?? data.man_cyl ?? 0) || 0,
    ax: safeAx(rawPlan?.ax ?? data.man_ax ?? 0),
    oz: parseFloat(rawPlan?.oz ?? 6.5) || 6.5,
    flap: Number(rawPlan?.flap ?? 110),
  };
  
  const isPRK = plan.flap === 0;
  const cctNum = parseFloat(data.cct) || 0;
  const flapNum = isPRK ? 0 : (parseFloat(draft.capOrFlap || String(plan.flap)) || 110);
  const fmt = (v: any) => { const n = parseFloat(String(v)); if (isNaN(n)) return '—'; return (n > 0 ? '+' : '') + n.toFixed(2); };

  const updatePower = (field: string, isPlus: boolean, step: number) => {
    const cur = (plan as any)[field] || 0;
    let next = cur;
    if (field === 'sph' || field === 'cyl') {
      if (cur < 0) next = isPlus ? cur - step : cur + step; else if (cur > 0) next = isPlus ? cur + step : cur - step; else next = isPlus ? 0.25 : -0.25;
      next = Math.round(next * 100) / 100; if (field === 'cyl' && next > 0) next = 0;
    } else if (field === 'ax') {
      next = isPlus ? cur + step : cur - step; if (next < 0) next = 180 + next; if (next >= 180) next = next - 180;
    } else if (field === 'oz') {
      next = isPlus ? cur + step : cur - step; next = Math.max(0, Math.round(next * 10) / 10);
    }
    setPlanField(planEye, field as any, next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 10 }}>
      <SectionHeader title="Diagnostics" />
      <div style={{ background: C.card, borderRadius: 24, padding: '6px 8px 10px', border: `1px solid ${C.border}`, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px', borderBottom: `1px solid ${C.border}20`, marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}><span style={{ fontSize: 7, fontWeight: 900, color: C.muted2 }}>BCVA</span><span style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: F.mono }}>{data.bcva || '1.0'}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: ec.color, fontFamily: F.mono }}>{fmt(data.man_sph)} / {fmt(data.man_cyl)} × {data.man_ax || '0'}°</div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AxisDial 
                axis={safeAx(data.man_ax)} 
                kAxis={safeAx(data.p_tot_a || data.k1_ax || data.k_ax)} 
                size={22} color={ec.color} tickWidth={1.5} 
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', columnGap: 4, rowGap: 2, alignItems: 'center', padding: '0 2px 0 12px' }}>
          <div /><div style={{ fontSize: 7, color: C.muted2, textAlign: 'center', fontWeight: 900, opacity: 0.6 }}>SPH</div><div style={{ fontSize: 7, color: C.muted2, textAlign: 'center', fontWeight: 900, opacity: 0.6 }}>CYL</div><div style={{ fontSize: 7, color: C.muted2, textAlign: 'center', fontWeight: 900, opacity: 0.6 }}>AXIS</div>
          <div style={{ fontSize: 8, color: C.indigo, fontWeight: 900, letterSpacing: '0.04em' }}>NARROW</div><div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, fontWeight: 600 }}>{fmt(data.n_sph)}</div><div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, fontWeight: 600 }}>{fmt(data.n_cyl)}</div><div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, fontWeight: 600 }}>{data.n_ax || '0'}°</div>
          <div style={{ fontSize: 8, color: C.muted2, fontWeight: 900, letterSpacing: '0.04em' }}>WIDE</div><div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, color: C.muted2 }}>{fmt(data.c_sph)}</div><div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, color: C.muted2 }}>{fmt(data.c_cyl)}</div><div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, color: C.muted2 }}>{data.c_ax || '0'}°</div>
          {(() => {
              const hasP = !!(data.p_tot_c || data.p_tot_k);
              const kavg = hasP ? data.p_tot_k : data.kavg;
              const cyl = hasP ? data.p_tot_c : ((parseFloat(data.k1) && parseFloat(data.k2)) ? '-' + Math.abs(parseFloat(data.k2) - parseFloat(data.k1)).toFixed(2) : '0.00');
              const ax = hasP ? data.p_tot_a : (data.k1_ax || data.k_ax || '0');
              return (
                <>
                  <div style={{ fontSize: 8, color: C.amber, fontWeight: 900, letterSpacing: '0.04em' }}>
                    {hasP ? 'PENTACAM' : 'CORNEAL K'}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, color: C.amber, fontWeight: 600 }}>{kavg || '—'}</div>
                  <div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, color: C.amber, fontWeight: 600 }}>{cyl}</div>
                  <div style={{ textAlign: 'center', fontSize: 10, fontFamily: F.mono, color: C.amber, fontWeight: 600 }}>{ax}°</div>
                </>
              );
          })()}
        </div>
      </div>

      <SectionHeader title="Laser Parameters" />
      <div style={{ background: C.card, borderRadius: 24, padding: '12px 10px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 4, background: C.surface, padding: 2, borderRadius: 10 }}>
              {(['manifest', 'corneal', 'vector', 'wavefront'] as const).map(s => {
                const currentStrategy = data.astigStrategy || draft.astigStrategy || 'manifest';
                return (
                  <button 
                    key={s} 
                    onClick={() => { 
                      haptic.light(); 
                      setDraft({ [planEye]: { ...data, astigStrategy: s } } as any); 
                      useSessionStore.getState().setPlanTweaked(false);
                    }} 
                    style={{ 
                      padding: '4px 8px', borderRadius: 8, border: 'none', 
                      background: currentStrategy === s ? C.cardHi : 'transparent', 
                      color: currentStrategy === s ? C.text : C.muted2, 
                      fontSize: 8, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' 
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => { haptic?.light(); toggleRounding(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 10,
                background: isRounding ? `${C.indigo}20` : C.surface,
                border: `1px solid ${isRounding ? C.indigo : C.border}`,
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isRounding ? C.indigo : C.muted3, boxShadow: isRounding ? `0 0 10px ${C.indigo}` : 'none' }} />
              <span style={{ fontSize: 8, fontWeight: 900, color: isRounding ? C.text : C.muted2, textTransform: 'uppercase' }}>0.25 STEP</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {[
              { label: 'SPH', val: plan.sph, step: 0.25, field: 'sph', fmt: (v:any)=> fmt(v), color: ec.color },
              { label: 'CYL', val: plan.cyl, step: 0.25, field: 'cyl', fmt: (v:any)=> parseFloat(v||0).toFixed(2), color: ec.color },
              { label: 'AXIS', val: plan.ax, step: 5, field: 'ax', fmt: (v:any)=> (v||0), color: ec.color, isAx: true },
              { label: 'OZ', val: plan.oz, step: 0.1, field: 'oz', fmt: (v:any)=> v.toFixed(1), color: C.indigo },
            ].map(f => (
              <div key={f.label} style={{ background: C.surface, borderRadius: 12, padding: '8px 0', border: `1px solid ${C.border}`, textAlign: 'center', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1px', marginBottom: 2 }}>
                  <button onClick={() => { haptic.light(); updatePower(f.field, false, f.step); }} style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.5 }}>−</button>
                  <div style={{ fontSize: 7, color: C.tertiary, fontWeight: 800, textTransform: 'uppercase', opacity: 0.4 }}>{f.label}</div>
                  <button onClick={() => { haptic.light(); updatePower(f.field, true, f.step); }} style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.5 }}>+</button>
                </div>
                <div 
                  onClick={() => handleStartEdit(f.field, f.val)}
                  style={{ fontSize: 15, fontWeight: 800, color: f.color, fontFamily: F.mono, cursor: 'text', minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {editingField === f.field ? (
                    <input 
                      ref={inputRef}
                      autoFocus value={tempValue} 
                      onChange={e => setTempValue(e.target.value)}
                      onBlur={handleFinishEdit}
                      onKeyDown={e => e.key === 'Enter' && handleFinishEdit()}
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: f.color, fontSize: 15, fontWeight: 800, fontFamily: F.mono, outline: 'none', padding: 0 }}
                    />
                  ) : (
                    <>
                      {f.fmt(f.val)}
                      {f.isAx && '°'}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
      </div>

      <SectionHeader title="Ablation Profile" />
      <div style={{ background: C.card, borderRadius: 24, padding: '14px 12px', border: `1px solid ${C.border}` }}>
        {(() => {
          const diopters = Math.abs(plan.sph + plan.cyl / 2);
          const finalAbl = Math.max(0, Math.round((Math.pow(plan.oz, 2) * diopters) / 3));
          const actualFlap = isPRK ? 0 : flapNum;
          const rsb = cctNum > 0 ? Math.round(cctNum - actualFlap - finalAbl) : 0;
          return (
            <CorneaSafetyCard 
              eye={planEye} 
              cct={cctNum || 550} 
              flap={actualFlap} 
              abl={finalAbl} 
              rsb={rsb} 
              pta={Math.round((actualFlap + finalAbl) / (cctNum || 550) * 100)} 
              kpost={(parseFloat(data.kavg) || 43) - diopters} 
              kpre={parseFloat(data.kavg) || 43} 
              isWarnRSB={rsb < 300} 
              hideFlap={isPRK}
              flapColor="#3b82f6"
            />
          );
        })()}
      </div>

      <SectionHeader title="Flap & Technique" />
      <div style={{ background: C.card, borderRadius: 24, padding: '12px 10px', border: `1px solid ${C.border}`, position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, filter: isPRK ? 'grayscale(0.8) opacity(0.3)' : 'none' }}>
            {[
              { label: 'DIAM', val: parseFloat(draft.flapDiam || '8.5'), step: 0.1, field: 'flapDiam', unit: 'mm' },
              { label: 'POS', val: parseFloat(draft.flapPos || '90'), step: 5, field: 'flapPos', unit: '°' },
            ].map(f => (
              <div key={f.label} style={{ background: C.surface, borderRadius: 10, padding: '6px 4px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><button onClick={() => !isPRK && setDraft({ [f.field]: String(Math.max(0, f.val - f.step)) })} style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 14, cursor: isPRK ? 'default' : 'pointer' }}>−</button><div style={{ fontSize: 7, color: C.tertiary, fontWeight: 700 }}>{f.label}</div><button onClick={() => !isPRK && setDraft({ [f.field]: String(f.val + f.step) })} style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 14, cursor: isPRK ? 'default' : 'pointer' }}>+</button></div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}><span style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{f.val.toFixed(f.label === 'DIAM' ? 1 : 0)}</span><span style={{ fontSize: 8, color: C.muted3 }}>{f.unit}</span></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 10, filter: isPRK ? 'grayscale(0.8) opacity(0.3)' : 'none', transition: 'all 0.3s', pointerEvents: isPRK ? 'none' : 'auto' }}>
            <div style={{ flex: 1, display: 'flex', gap: 4, background: C.surface, padding: 2, borderRadius: 10 }}>{(['fs', 'mechanical'] as const).map(t => (<button key={t} onClick={() => { haptic.light(); setDraft({ flapTech: t }); }} style={{ flex: 1, padding: '4px 0', borderRadius: 8, border: 'none', background: (draft.flapTech || 'fs') === t ? C.cardHi : 'transparent', color: (draft.flapTech || 'fs') === t ? C.indigo : C.muted2, fontSize: 8, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>{t === 'fs' ? 'Femto' : 'Mech'}</button>))}</div>
            <button onClick={() => { haptic.light(); setDraft({ flapSide: draft.flapSide === 'SUP' ? 'NAS' : draft.flapSide === 'NAS' ? 'TEM' : 'SUP' }); }} style={{ height: 24, padding: '0 8px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.indigo, fontSize: 8, fontWeight: 900, cursor: 'pointer' }}>{draft.flapSide || 'SUP'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, position: 'relative', zIndex: 1000 }}>
            {([90, 100, 110, 'PRK'] as const).map(v => {
              const val = v === 'PRK' ? 0 : Number(v);
              const active = Number(plan.flap) === val;
              return (<div key={v} onClick={() => { haptic.light(); setPlanField(planEye, 'flap', val); setDraft({ capOrFlap: String(val) }); }} style={{ padding: '6px 0', borderRadius: 10, border: `1px solid ${active ? C.indigo : C.border}`, background: active ? C.cardHi : C.surface, color: active ? C.text : C.muted2, fontSize: 9, fontWeight: 800, fontFamily: F.mono, cursor: 'pointer', textAlign: 'center', userSelect: 'none', touchAction: 'manipulation' }}>{v}</div>);
            })}
          </div>
      </div>
    </div>
  );
}

export function PlanTab() {
  const { draft, setDraft, toggleSurgicalEye } = useSessionStore();
  const { planEye, setPlanEye } = useUIStore();
  const { haptic } = useTelegram();
  const [showCalendar, setShowCalendar] = useState(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <EyeToggle 
        value={planEye} 
        onChange={setPlanEye} 
        onLongPress={handleLongPressEye} 
        disabledEyes={disabledEyes} 
      />
      {draft.type === 'cataract' ? <CataractPlanTab /> : <RefractionPlanTab />}
      <div style={{ paddingBottom: 10 }}>
        <button onClick={() => { haptic.light(); setShowCalendar(!showCalendar); }} style={{ width: '100%', background: draft.date ? `${C.green}15` : C.accentLt, border: `1px solid ${draft.date ? C.green : C.accent}40`, borderRadius: 20, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: draft.date ? C.green : C.accent, fontFamily: F.sans, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {draft.date ? `SURGERY: ${new Date(draft.date).toLocaleDateString()}` : 'SCHEDULE SURGERY'}
        </button>
        {showCalendar && <Calendar selectedDate={draft.date || null} onSelect={iso => { haptic.success(); setDraft({ date: iso, status: 'planned' }); setShowCalendar(false); }} />}
      </div>
    </div>
  );
}
