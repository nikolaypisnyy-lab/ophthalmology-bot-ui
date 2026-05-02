import { useEffect, useState, useRef } from 'react';
import { C, F, R, eyeColors } from '../../../constants/design';
import { Calendar } from '../../../ui/Calendar';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { EyeToggle, SectionLabel, Divider, AxisDial, AutoRepeatButton } from '../../../ui';
import { ToricSchematic } from '../../../ui/ToricSchematic';
import { newEyeData } from '../../../types/refraction';
import { CorneaSafetyCard } from '../../ablation/CorneaSafetyCard';
import { useTelegram } from '../../../hooks/useTelegram';
import { calcEx500 } from '../../../calculators/ex500';
import { getNomogramTarget } from '../../../calculators/nomogram';
import { MedDisclaimer } from '../../disclaimer/MedDisclaimer';

const safeAx = (val: any) => {
  const a = parseInt(String(val));
  return isNaN(a) ? 0 : a;
};

const SectionHeader = ({ title }: { title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 4px 2px' }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: C.tertiary || C.secondary, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</span>
    <div style={{ flex: 1, height: 1, background: C.border, opacity: 0.4 }} />
  </div>
);


function CataractPlanTab() {
  const { draft, iolResult, toricResults, formulaResults } = useSessionStore();
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
  const steepAx = hasPentacam ? (parseFloat(eyeData.p_tot_a || '0') + 90) % 180 : (k2 > k1 ? (k1Ax + 90) % 180 : k1Ax);

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

          <SectionLabel color={C.amber} style={{ marginBottom: 32, textAlign: 'center', fontSize: 10, letterSpacing: '0.15em' }}>
            TORIC IOL · IMPLANTATION PLANE
          </SectionLabel>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, marginTop: 8 }}>
            <ToricSchematic
              eye={planEye}
              incisionAx={incisionAx}
              toricAx={toricAx}
              steepAx={steepAx}
              size={240}
            />
          </div>

          {/* Axis legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14, marginTop: 32 }}>
            <div style={{ background: `${C.indigo}15`, padding: '4px 8px', borderRadius: 10, border: `1px solid ${C.indigo}30`, textAlign: 'center' }}>
              <div style={{ fontSize: 6, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', marginBottom: 0 }}>INCISION</div>
              <div style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 400, color: C.text }}>{incisionAx}°</div>
            </div>
            <div style={{ background: `${C.amber}15`, padding: '4px 8px', borderRadius: 10, border: `1px solid ${C.amber}30`, textAlign: 'center' }}>
              <div style={{ fontSize: 6, fontWeight: 900, color: C.amber, textTransform: 'uppercase', marginBottom: 0 }}>IOL AXIS</div>
              <div style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 400, color: C.text }}>
                {toricAx != null ? `${Math.round(toricAx)}°` : '—'}
              </div>
            </div>
          </div>

          {toric ? (() => {
            const selectedModel = (iolResult as any)?.[planEye]?.selectedToricModel || toric.best_model;
            const best = toric.table?.find((s: any) => s.model === selectedModel);
            const cylIol  = best?.cyl_iol  ?? null;
            const residual = best?.residual ?? null;
            const resAxis  = best?.res_axis ?? null;
            const implantAxis = toric.total_steep_axis ?? null;
            const iolPower = r?.selectedPower ?? parseFloat((iolResult as any)?.power) ?? null;
            const residualOk = residual != null && residual < 0.5;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>

                {/* Prescription строка */}
                <div style={{
                  background: `${C.amber}10`, borderRadius: 16, padding: '10px 14px',
                  border: `1px solid ${C.amber}30`,
                }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, textAlign: 'center' }}>
                    Toric IOL Prescription
                  </div>
                  {/* Строка 1: модель + цилиндр */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 900, color: C.text, textAlign: 'center' }}>
                      {((iolResult as any)?.lens || 'IOL').replace('Toric', '').trim()} {selectedModel || ''}
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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span style={{ fontSize: 8, fontWeight: 900, color: residualOk ? C.green : C.amber, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Residual
                    </span>
                    {residual != null ? (
                      <>
                        <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 800, color: residualOk ? C.green : C.amber }}>
                          {residual < 0.01 ? '0.00' : `-${residual.toFixed(2)}`}D
                        </span>
                        {resAxis != null && (
                          <>
                            <span style={{ fontSize: 10, color: C.muted3 }}>@</span>
                            <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 800, color: residualOk ? C.green : C.amber }}>
                              {Math.round(resAxis)}°
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span style={{ fontFamily: F.mono, fontSize: 14, color: C.muted3 }}>—</span>
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
          {(() => {
            const fResults = formulaResults[planEye]?.[draft.activeFormula || 'Barrett'] || [];
            const powerVal = r?.selectedPower || parseFloat((iolResult as any)?.power || '0');
            const match = fResults.find((x: any) => Math.abs(x.power - powerVal) < 0.01);
            const predVal = r?.expectedRefr ?? match?.refraction ?? match?.ref;
            
            return [
              { label: 'TARGET', val: draft.targetRefr || '0.00', color: ec.color },
              { label: 'FORMULA', val: (draft.activeFormula || 'Barrett').toUpperCase(), color: C.indigo },
              { label: 'PRED. REF', val: predVal != null ? (predVal > 0 ? '+' : '') + predVal.toFixed(2) : '—', color: C.green },
            ].map(l => (
              <div key={l.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '10px 4px', border: `1px solid ${C.border}40`, textAlign: 'center' }}>
                <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{l.label}</div>
                <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: l.color }}>{l.val}</div>
              </div>
            ));
          })()}
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
      if (isRounding && (editingField === 'sph' || editingField === 'cyl')) {
        v = Math.round(v * 4) / 4;
      }
      setPlanField(planEye, editingField as any, v);
    }
    setEditingField(null);
  };

  useEffect(() => {
    if (!draft || planTweaked) return;
    const data = (draft as any)[planEye] || newEyeData();
    const strategy = (data as any)?.astigStrategy || (draft as any)?.astigStrategy || 'manifest';
    let bSph = parseFloat(data.man_sph) || 0;
    let bCyl = parseFloat(data.man_cyl) || 0;
    let bAx = safeAx(data.man_ax);

    if (strategy === 'wavefront' || strategy === 'vector') {
      bSph = parseFloat(data.w_sph) || parseFloat(data.man_sph) || 0;
      bCyl = parseFloat(data.w_cyl) || parseFloat(data.man_cyl) || 0;
      bAx = safeAx(data.w_ax) || safeAx(data.man_ax);
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

    let finalSph = Math.round(targetSph * 100) / 100;
    let finalCyl = Math.round(targetCyl * 100) / 100;

    if (isRounding) {
      finalSph = Math.round(finalSph * 4) / 4;
      finalCyl = Math.round(finalCyl * 4) / 4;
    }

    const currentPlan = refPlan?.[planEye];
    const needsUpdate = !currentPlan || (currentPlan.sph !== finalSph || currentPlan.cyl !== finalCyl || currentPlan.ax !== bAx);

    if (needsUpdate) {
      const { autoSetPlan } = useSessionStore.getState();
      autoSetPlan(planEye, { sph: finalSph, cyl: finalCyl, ax: bAx });
    }
  }, [draft?.laser, draft?.od?.astigStrategy, draft?.os?.astigStrategy, draft?.astigStrategy, planEye, draft?.od?.man_sph, draft?.os?.man_sph, draft?.od?.man_cyl, draft?.os?.man_cyl, draft?.od?.w_sph, draft?.os?.w_sph, draft?.od?.w_cyl, draft?.os?.w_cyl, planTweaked, isRounding, activeRefNomo, activeRefNomoCyl]);

  if (!draft) return null;

  const ec = eyeColors(planEye);
  const data = (draft as any)?.[planEye] || newEyeData();
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
    const latestPlan = (useSessionStore.getState().refPlan as any)?.[planEye] || {};
    const latestData = (useSessionStore.getState().draft as any)?.[planEye] || {};
    
    // Merge latest data for fallback
    const curVal = latestPlan[field] ?? latestData[field] ?? (field === 'oz' ? 6.5 : (field === 'flap' ? 110 : 0));
    let cur = parseFloat(String(curVal)) || 0;
    
    // If rounding is on, ensure we start from a rounded value
    if (isRounding && (field === 'sph' || field === 'cyl')) {
      cur = Math.round(cur * 4) / 4;
    }

    let next = cur;
    if (field === 'sph' || field === 'cyl') {
      if (cur < 0) next = isPlus ? cur - step : cur + step; else if (cur > 0) next = isPlus ? cur + step : cur - step; else next = isPlus ? 0.25 : -0.25;
      next = Math.round(next * 100) / 100; if (field === 'cyl' && next > 0) next = 0;
      if (isRounding) next = Math.round(next * 4) / 4;
    } else if (field === 'ax') {
      next = isPlus ? cur + step : cur - step; if (next < 0) next = 180 + next; if (next >= 180) next = next - 180;
    } else if (field === 'oz') {
      next = isPlus ? cur + step : cur - step; next = Math.max(0, Math.round(next * 10) / 10);
    }
    setPlanField(planEye, field as any, next);
    haptic.light();
  };

  const fmtVA = (val: any) => {
    const n = parseFloat(String(val));
    if (isNaN(n)) return val || '1.0';
    return n.toFixed(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 10 }}>
      <SectionHeader title="Diagnostics" />
      <div style={{ background: C.card, borderRadius: 24, padding: '10px 12px', border: `1px solid ${C.border}`, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: `1px solid ${C.border}20`, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>BCVA</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: C.green, fontFamily: F.mono }}>{fmtVA(data.bcva)}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: ec.color, fontFamily: F.mono }}>{fmt(data.man_sph)} / {fmt(data.man_cyl)} × {data.man_ax || '0'}°</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* KERATOMETRY ROW */}
            {(() => {
              const hasP = !!(data.p_tot_c || data.p_tot_k);
              const kavg = hasP ? data.p_tot_k : data.kavg;
              const cyl = hasP ? data.p_tot_c : ((parseFloat(data.k1) && parseFloat(data.k2)) ? '-' + Math.abs(parseFloat(data.k2) - parseFloat(data.k1)).toFixed(2) : '0.00');
              const ax = hasP ? data.p_tot_a : (data.k1_ax || data.k_ax || '0');
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>{hasP ? 'PENTA' : 'KERAT'}</span>
                  <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: C.amber }}>{kavg || '—'}</div>
                  <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: C.amber }}>{cyl}</div>
                  <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: C.amber }}>{ax}°</div>
                </div>
              );
            })()}

            {/* NARROW ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: C.indigo, textTransform: 'uppercase' }}>NARROW</span>
              <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.indigo }}>{fmt(data.n_sph)}</div>
              <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.indigo }}>{fmt(data.n_cyl)}</div>
              <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.indigo }}>{data.n_ax || '0'}°</div>
            </div>

            {/* WIDE ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>WIDE</span>
              <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, color: C.muted2 }}>{fmt(data.c_sph)}</div>
              <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, color: C.muted2 }}>{fmt(data.c_cyl)}</div>
              <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, color: C.muted2 }}>{data.c_ax || '0'}°</div>
            </div>
          </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 0 }}>
                  <div style={{ textAlign: 'center', lineHeight: 1 }}>
                    <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Astigmatism</div>
                    <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Axis</div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, flexShrink: 0 }}>
                    <AxisDial 
                      axis={safeAx(data.man_ax)} 
                      kAxis={safeAx(data.p_tot_a || data.k1_ax || data.k_ax)} 
                      size={36} color={ec.color} tickWidth={1.5} 
                    />
                  </div>
                  <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: C.text, textTransform: 'uppercase', marginBottom: 1 }}>{type}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: C.amber, fontFamily: F.mono }}>{cylVal.toFixed(2)}D</div>
                      <div style={{ fontSize: 7, fontWeight: 800, color: C.muted2, fontFamily: F.mono, opacity: 0.8 }}>ax {steep}°</div>
                    </div>
                  </div>
                </div>
              );
            })()}
      </div>

      <SectionHeader title="Laser Parameters" />
      <div style={{ background: C.card, borderRadius: 24, padding: '8px 10px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 4, background: C.surface, padding: 2, borderRadius: 10 }}>
              {(['manifest', 'corneal', 'vector', 'wavefront'] as const).map(s => {
                const currentStrategy = (data as any)?.astigStrategy || (draft as any)?.astigStrategy || 'manifest';
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'SPH', val: plan.sph, step: 0.25, field: 'sph', fmt: (v:any)=> fmt(v), color: ec.color },
              { label: 'CYL', val: plan.cyl, step: 0.25, field: 'cyl', fmt: (v:any)=> parseFloat(v||0).toFixed(2), color: ec.color },
              { label: 'AXIS', val: plan.ax, step: 5, field: 'ax', fmt: (v:any)=> (v||0), color: ec.color, isAx: true },
            ].map(f => (
              <div key={f.label} style={{ background: C.surface, borderRadius: 14, padding: '4px 0 8px', border: `1px solid ${C.border}`, textAlign: 'center', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 2px', borderBottom: `1px solid ${C.border}30`, marginBottom: 4 }}>
                  <AutoRepeatButton onTrigger={() => { haptic.light(); updatePower(f.field, false, f.step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 20, padding: '8px 12px', margin: '-8px -8px', cursor: 'pointer' }}>−</AutoRepeatButton>
                  <div style={{ fontSize: 7, color: C.muted2, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</div>
                  <AutoRepeatButton onTrigger={() => { haptic.light(); updatePower(f.field, true, f.step); }} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 20, padding: '8px 12px', margin: '-8px -8px', cursor: 'pointer' }}>+</AutoRepeatButton>
                </div>
                <div 
                  onClick={() => handleStartEdit(f.field, f.val)}
                  style={{ fontSize: 22, fontWeight: 900, color: f.color, fontFamily: F.mono, cursor: 'text', minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  {editingField === f.field ? (
                    <input 
                      ref={inputRef}
                      autoFocus value={tempValue} 
                      onChange={e => setTempValue(e.target.value)}
                      onBlur={handleFinishEdit}
                      onKeyDown={e => e.key === 'Enter' && handleFinishEdit()}
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color: f.color, fontSize: 20, fontWeight: 900, fontFamily: F.mono, outline: 'none', padding: 0 }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      {f.fmt(f.val)}
                      {f.isAx && <span style={{ fontSize: 12 }}>°</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: C.surface, borderRadius: 12, padding: '4px 12px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Optical Zone (OZ)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AutoRepeatButton onTrigger={() => updatePower('oz', false, 0.1)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 8px', cursor: 'pointer' }}>−</AutoRepeatButton>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.indigo, fontFamily: F.mono }}>{plan.oz.toFixed(1)}<span style={{ fontSize: 9, color: C.muted3, marginLeft: 2 }}>mm</span></span>
              <AutoRepeatButton onTrigger={() => updatePower('oz', true, 0.1)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '4px 8px', cursor: 'pointer' }}>+</AutoRepeatButton>
            </div>
          </div>
      </div>

      <SectionHeader title="Ablation Profile" />
      <div style={{ background: C.card, borderRadius: 24, padding: '10px 12px', border: `1px solid ${C.border}` }}>
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
      <div style={{ background: C.card, borderRadius: 24, padding: '8px 10px', border: `1px solid ${C.border}`, position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, filter: isPRK ? 'grayscale(0.8) opacity(0.3)' : 'none' }}>
            {[
              { label: 'DIAM', val: parseFloat(draft.flapDiam || '8.5'), step: 0.1, field: 'flapDiam', unit: 'mm' },
              { label: 'POS', val: parseFloat(draft.flapPos || '90'), step: 5, field: 'flapPos', unit: '°' },
            ].map(f => (
              <div key={f.label} style={{ background: C.surface, borderRadius: 10, padding: '4px 4px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <AutoRepeatButton 
                    onTrigger={() => !isPRK && setDraft({ [f.field]: String(Math.max(0, f.val - f.step)) })} 
                    style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 18, padding: '8px 12px', margin: '-8px -8px', cursor: isPRK ? 'default' : 'pointer' }}
                  >−</AutoRepeatButton>
                  <div style={{ fontSize: 7, color: C.tertiary, fontWeight: 700 }}>{f.label}</div>
                  <AutoRepeatButton 
                    onTrigger={() => !isPRK && setDraft({ [f.field]: String(f.val + f.step) })} 
                    style={{ background: 'none', border: 'none', color: C.tertiary, fontSize: 18, padding: '8px 12px', margin: '-8px -8px', cursor: isPRK ? 'default' : 'pointer' }}
                  >+</AutoRepeatButton>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{f.val.toFixed(f.label === 'DIAM' ? 1 : 0)}</span>
                  <span style={{ fontSize: 8, color: C.muted3 }}>{f.unit}</span>
                </div>
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
      <MedDisclaimer />
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
