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

// Safe date parser for iOS/Safari
const parseDateSafe = (d: any) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  try {
    const s = String(d);
    if (s.includes('.')) {
      const [day, month, year] = s.split('.');
      if (day && month && year) return new Date(`${year}-${month}-${day}`);
    }
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
  } catch (e) { return null; }
};

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
  try {
    const { draft, iolResult, formulaResults, iolResults, toricResults } = useSessionStore();
    const { planEye } = useUIStore();
    if (!draft) return null;

    const ec = eyeColors(planEye);
    const eyeData = (draft[planEye] as any) || {};

    const resByEye = (iolResult as any)?.[planEye] || (iolResults as any)?.[planEye];
    const globalRes = (draft as any)?.iolResult;
    const activeResult = resByEye || globalRes || {};

    // lens хранится на верхнем уровне iolResult
    const selectedLens = (iolResult as any)?.lens || (draft as any)?.iolResult?.lens || activeResult.lens || activeResult.model || 'IOL';
    const selectedPower = activeResult.selectedPower ?? activeResult.power ?? activeResult.p;
    const siaVal = (draft as any).sia || (draft as any).siaVal || '0.20';

    // Торик: приоритет явно выбранной модели над рекомендованной
    const toricData = (toricResults as any)?.[planEye];
    const selectedToricModel = (iolResult as any)?.[planEye]?.selectedToricModel ?? toricData?.best_model ?? '';
    const toricTable = toricData?.table ?? [];
    const toricRow = toricTable.find((r: any) => r.model === selectedToricModel);
    const cylIol = toricRow?.cyl_iol ?? activeResult.cyl ?? activeResult.c;
    // Ось имплантации из toricResults (рассчитанная)
    const iolAx = toricData?.total_steep_axis ?? (iolResult as any)?.[planEye]?.toricAxis ?? activeResult.axis ?? activeResult.ax;

    const isToric = !!(draft as any).toricMode || (!!cylIol && parseFloat(String(cylIol)) !== 0) || String(selectedLens).toLowerCase().includes('toric');
    const incisionAx = parseInt(String((draft as any).incAx || draft.siaAx || '90')) || 90;

    const hasPentacam = !!(eyeData.p_tot_c || eyeData.p_tot_k);
    const k1 = parseFloat(eyeData.k1 || '0');
    const k2 = parseFloat(eyeData.k2 || '0');
    const k1Ax = parseFloat(eyeData.k_ax || eyeData.k1_ax || '0');
    const kavg = hasPentacam ? eyeData.p_tot_k : (eyeData.kavg || ((k1 + k2) / 2).toFixed(2));
    const cyl  = hasPentacam ? eyeData.p_tot_c : (k1 && k2 ? (k2 - k1).toFixed(2) : '0.00');
    const steepAx = hasPentacam ? parseFloat(eyeData.p_tot_a || '0') : (k2 > k1 ? (k1Ax + 90) % 180 : k1Ax);
    const ax = steepAx;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 1. TORIC PLANNING BLOCK */}
        {isToric && (
          <div style={{ background: C.card, borderRadius: 24, padding: '20px 16px', border: `1px solid ${C.border}`, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(255,191,0,0.1)', padding: '4px 12px', borderRadius: 20 }}>TORIC PLANNING</div>
            </div>

            {/* BIG SCHEMATIC */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <ToricSchematic
                eye={planEye}
                incisionAx={incisionAx}
                toricAx={iolAx != null ? parseFloat(String(iolAx)) : null}
                steepAx={steepAx}
                size={240}
              />
            </div>

            {/* PRIMARY PARAMETERS: INCISION & PLACEMENT */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: `1px solid ${C.border}40`, textAlign: 'center' }}>
                <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', marginBottom: 6 }}>Incision Axis</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.text, fontFamily: F.mono, lineHeight: 1 }}>{incisionAx}°</div>
                <div style={{ fontSize: 8, fontWeight: 800, color: C.amber, marginTop: 4, fontFamily: F.mono }}>SIA {siaVal}D</div>
              </div>
              <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: `1px solid ${C.border}40`, textAlign: 'center' }}>
                <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', marginBottom: 6 }}>IOL Placement</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.amber, fontFamily: F.mono, lineHeight: 1 }}>{iolAx || '—'}°</div>
                <div style={{ fontSize: 8, fontWeight: 800, color: C.muted2, marginTop: 4 }}>AXIS</div>
              </div>
            </div>

            {/* SECONDARY PARAMETERS: TORIC CYLINDER + RESIDUAL */}
            <div style={{ padding: '14px', background: `${C.indigo}08`, borderRadius: 16, border: `1px solid ${C.indigo}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 8, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', marginBottom: 2 }}>
                  {selectedToricModel || 'Selected Toric Cyl'}
                </div>
                {(() => {
                  const residual = toricRow?.residual ?? toricRow?.res_cyl;
                  if (residual == null) return null;
                  const resOk = parseFloat(String(residual)) < 0.5;
                  return (
                    <div style={{ fontSize: 8, fontWeight: 800, color: resOk ? C.green : C.amber, marginTop: 2 }}>
                      Residual {parseFloat(String(residual)).toFixed(2)} D
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                  {cylIol != null ? `+${parseFloat(String(cylIol)).toFixed(2)}` : '—'}
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.muted2 }}>D</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. SELECTED MODEL & POWER */}
        <div style={{ background: C.card, borderRadius: 24, padding: '24px 20px', border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${ec.color}, ${C.indigo})` }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>SELECTED MODEL</div>
              <div style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1.2 }}>{String(selectedLens).replace('Toric', '').trim()}</div>
            </div>
            <div style={{ textAlign: 'right', marginLeft: 12 }}>
              <div style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 900, color: ec.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>POWER</div>
              <div style={{ fontFamily: F.mono, fontSize: 36, fontWeight: 900, color: ec.color }}>
                {parseFloat(String(selectedPower || '0')).toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(() => {
              const activeFormula = draft.activeFormula || 'Barrett';
              const fResults = (formulaResults as any)?.[planEye]?.[activeFormula] || [];
              const pVal = parseFloat(String(selectedPower || '0'));
              const match = fResults.find((x: any) => Math.abs(x.power - pVal) < 0.01);
              const predVal = activeResult.expectedRefr ?? match?.refraction ?? match?.ref;
              
              return [
                { label: 'TARGET', val: draft.targetRefr || '0.00', color: ec.color },
                { label: 'FORMULA', val: activeFormula.toUpperCase(), color: C.indigo },
                { label: 'PRED. REF', val: predVal != null ? (predVal > 0 ? '+' : '') + parseFloat(String(predVal)).toFixed(2) : '—', color: C.green },
              ].map(l => (
                <div key={l.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '10px 4px', border: `1px solid ${C.border}40`, textAlign: 'center' }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{l.label}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: l.color }}>{l.val}</div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* 3. EYE DATA */}
        <div style={{ background: C.card, borderRadius: 20, padding: '12px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}` }}>
            <AxisDial axis={ax} kAxis={ax} size={36} color={C.amber} />
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>K-AVG</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.amber, fontFamily: F.mono }}>{kavg}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>CYL</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.amber, fontFamily: F.mono }}>{cyl}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>AL</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: ec.color, fontFamily: F.mono }}>{eyeData.al || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    return <div style={{ padding: 20, color: 'white', background: 'red' }}>CATARACT ERROR: {String(err)}</div>;
  }
}


function RefractionPlanTab() {
  try {
    const { draft, setDraft, refPlan, setPlanField, planTweaked, isRounding, toggleRounding } = useSessionStore();
    const { planEye, editingField, setEditingField, tempValue, setTempValue } = useUIStore();
    const { activeRefNomo, activeRefNomoCyl, defaultFlap } = useClinicStore();
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
      if (!draft || planTweaked || !planEye) return;
      const data = (draft as any)[planEye];
      if (!data || !data.man_sph) return;

      const strategy = (data as any)?.astigStrategy || (draft as any)?.astigStrategy || 'manifest';
      let bSph = parseFloat(data.man_sph) || 0;
      let bCyl = parseFloat(data.man_cyl) || 0;
      let bAx = safeAx(data.man_ax);

      if (strategy === 'wavefront' || strategy === 'vector') {
        bSph = parseFloat(data.w_sph) || parseFloat(data.man_sph) || 0;
        bCyl = parseFloat(data.w_cyl) || parseFloat(data.man_cyl) || 0;
        bAx = safeAx(data.w_ax) || safeAx(data.man_ax);
      } else if (strategy === 'corneal') {
        bSph = parseFloat(data.n_sph) || parseFloat(data.man_sph) || 0;
        bCyl = parseFloat(data.n_cyl) || parseFloat(data.man_cyl) || 0;
        bAx = safeAx(data.n_ax) || safeAx(data.man_ax);
      }

      let age = 40;
      if (draft.birthDate) {
        const b = parseDateSafe(draft.birthDate);
        if (b) {
          const n = new Date();
          age = n.getFullYear() - b.getFullYear();
          if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
        }
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

      if (activeRefNomo) targetSph += activeRefNomo;
      if (activeRefNomoCyl) targetCyl += activeRefNomoCyl;

      let finalSph = Math.round(targetSph * 100) / 100;
      let finalCyl = Math.round(targetCyl * 100) / 100;

      if (isRounding) {
        finalSph = Math.round(finalSph * 4) / 4;
        finalCyl = Math.round(finalCyl * 4) / 4;
      }

      const currentPlan = refPlan?.[planEye];
      const diffSph = Math.abs((currentPlan?.sph ?? 0) - finalSph);
      const diffCyl = Math.abs((currentPlan?.cyl ?? 0) - finalCyl);
      const needsUpdate = !currentPlan || diffSph > 0.01 || diffCyl > 0.01 || (currentPlan?.ax !== bAx);

      if (needsUpdate && !isNaN(finalSph) && !isNaN(finalCyl)) {
        const { autoSetPlan } = useSessionStore.getState();
        autoSetPlan(planEye, { sph: finalSph, cyl: finalCyl, ax: bAx });
      }
    }, [draft?.laser, draft?.birthDate, draft?.od?.astigStrategy, draft?.os?.astigStrategy, draft?.astigStrategy, planEye, draft?.od?.man_sph, draft?.os?.man_sph, draft?.od?.man_cyl, draft?.os?.man_cyl, draft?.od?.w_sph, draft?.os?.w_sph, draft?.od?.w_cyl, draft?.os?.w_cyl, draft?.od?.n_sph, draft?.os?.n_sph, draft?.od?.n_cyl, draft?.os?.n_cyl, planTweaked, isRounding, activeRefNomo, activeRefNomoCyl]);


    if (!draft) return null;

    const ec = eyeColors(planEye);
    const data = (draft as any)?.[planEye] || newEyeData();
    const rawPlan = (refPlan as any)?.[planEye];
    const plan = {
      sph: parseFloat(rawPlan?.sph ?? data.man_sph ?? 0) || 0,
      cyl: parseFloat(rawPlan?.cyl ?? data.man_cyl ?? 0) || 0,
      ax: safeAx(rawPlan?.ax ?? data.man_ax ?? 0),
      oz: parseFloat(rawPlan?.oz ?? 6.5) || 6.5,
      flap: Number(rawPlan?.flap ?? defaultFlap),
    };
    
    const isPRK = plan.flap === 0;
    const cctNum = parseFloat(data.cct) || 0;
    const fmt = (v: any) => { const n = parseFloat(String(v)); if (isNaN(n)) return '—'; return (n > 0 ? '+' : '') + n.toFixed(2); };

    const updatePower = (field: string, isPlus: boolean, step: number) => {
      const latestPlan = (useSessionStore.getState().refPlan as any)?.[planEye] || {};
      const latestData = (useSessionStore.getState().draft as any)?.[planEye] || {};
      const curVal = latestPlan[field] ?? latestData[field] ?? (field === 'oz' ? 6.5 : (field === 'flap' ? 110 : 0));
      let cur = parseFloat(String(curVal)) || 0;
      if (isRounding && (field === 'sph' || field === 'cyl')) cur = Math.round(cur * 4) / 4;
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

              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: C.slate, textTransform: 'uppercase' }}>NARROW</span>
                <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.slate }}>{fmt(data.n_sph)}</div>
                <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.slate }}>{fmt(data.n_cyl)}</div>
                <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.slate }}>{data.n_ax || '0'}°</div>
              </div>

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
                const steep = (kAx + 90) % 180;
                let type = 'Oblique';
                if ((steep >= 0 && steep <= 30) || (steep >= 150 && steep <= 180)) type = 'ATR';
                else if (steep >= 60 && steep <= 120) type = 'WTR';
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, flexShrink: 0 }}>
                      <AxisDial axis={safeAx(data.man_ax)} kAxis={safeAx(data.p_tot_a || data.k1_ax || data.k_ax)} size={36} color={ec.color} tickWidth={1.5} />
                    </div>
                    <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: C.text, textTransform: 'uppercase' }}>{type}</div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: C.amber, fontFamily: F.mono }}>{cylVal.toFixed(2)}D</div>
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
                    <button key={s} onClick={() => { haptic.light(); setDraft({ [planEye]: { ...data, astigStrategy: s } } as any); useSessionStore.getState().setPlanTweaked(false); }} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: currentStrategy === s ? C.cardHi : 'transparent', color: currentStrategy === s ? C.indigo : C.muted2, fontSize: 8, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>{s}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'SPH', field: 'sph', step: 0.25, val: plan.sph, color: ec.color, fmt: (v:any)=> (v>0?'+':'')+v.toFixed(2) },
                { label: 'CYL', field: 'cyl', step: 0.25, val: plan.cyl, color: ec.color, fmt: (v:any)=> v.toFixed(2) },
                { label: 'AXIS', field: 'ax', step: 5,    val: plan.ax, color: ec.color, fmt: (v:any)=> (v||0)+'°' },
              ].map((f:any) => (
                <div key={f.label} style={{ flex: 1, background: C.surface, borderRadius: 16, padding: '10px 4px', border: `1px solid ${C.border}`, textAlign: 'center', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 6px', borderBottom: `1px solid ${C.border}40`, marginBottom: 10 }}>
                    <AutoRepeatButton onTrigger={() => updatePower(f.field, false, f.step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 20 }}>−</AutoRepeatButton>
                    <div style={{ fontSize: 7, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>{f.label}</div>
                    <AutoRepeatButton onTrigger={() => updatePower(f.field, true, f.step)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 20 }}>+</AutoRepeatButton>
                  </div>
                  <div onClick={() => handleStartEdit(f.field, f.val)} style={{ fontSize: 22, fontWeight: 900, color: `${f.color} !important`, fontFamily: F.mono, lineHeight: 1 }}>
                    {editingField === f.field ? (
                      <input 
                        ref={inputRef} 
                        value={tempValue} 
                        onChange={e=>setTempValue(e.target.value)} 
                        onBlur={handleFinishEdit} 
                        onKeyDown={e=>e.key==='Enter'&&handleFinishEdit()} 
                        style={{ 
                          width: '100%', background: 'none', border: 'none', 
                          textAlign: 'center', color: f.color, 
                          fontSize: 18, fontWeight: 900, fontFamily: F.mono, 
                          outline: 'none',
                          WebkitTextFillColor: f.color
                        }} 
                      />
                    ) : (
                      <span style={{ color: f.color }}>{f.fmt(f.val)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>Opt Zone</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface, borderRadius: 10, padding: '4px 10px', border: `1px solid ${C.border}` }}>
                  <AutoRepeatButton onTrigger={() => updatePower('oz', false, 0.1)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18 }}>−</AutoRepeatButton>
                  <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: C.text }}>{plan.oz.toFixed(1)}</span>
                  <AutoRepeatButton onTrigger={() => updatePower('oz', true, 0.1)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18 }}>+</AutoRepeatButton>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>Method</span>
                <div onClick={() => { haptic.light(); setPlanField(planEye, 'flap', plan.flap === 0 ? 110 : 0); }} style={{ height: 24, borderRadius: 10, background: plan.flap === 0 ? C.surface : C.cardHi, border: `1px solid ${C.border}`, color: plan.flap === 0 ? C.muted2 : C.indigo, fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{plan.flap === 0 ? 'PRK' : 'LASIK'}</div>
              </div>
            </div>
        </div>

        {(() => {
          const diopters = Math.abs(plan.sph) + Math.abs(plan.cyl) * 0.7;
          const ablPerD = 13 + (plan.oz - 6.0) * 10;
          const actualFlap = isPRK ? 0 : (parseFloat(draft.capOrFlap || String(plan.flap)) || 110);
          const finalAbl = Math.ceil(ablPerD * diopters);
          const rsb = cctNum - actualFlap - finalAbl;
          const kpost = parseFloat(data.kavg || '43.5') + (plan.sph + plan.cyl * 0.5) * 0.8;
          return (
            <div style={{ marginTop: 6 }}>
              <CorneaSafetyCard eye={planEye} cct={cctNum || 550} flap={actualFlap} abl={finalAbl} rsb={rsb} pta={Math.round((actualFlap + finalAbl) / (cctNum || 550) * 100)} kpost={kpost} />
            </div>
          );
        })()}

        {!isPRK && (
          <div style={{ marginTop: 6 }}>
            <SectionHeader title="Flap Parameters" />
            <div style={{ background: C.card, borderRadius: 24, padding: '12px 16px', border: `1px solid ${C.border}`, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>Model</span>
                  <select 
                    value={draft.flapModel || 'FS200'} 
                    onChange={(e) => setDraft({ flapModel: e.target.value })}
                    style={{ height: 32, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 10, fontWeight: 800, padding: '0 4px', outline: 'none' }}
                  >
                    <option value="FS200">FS200</option>
                    <option value="Moria M2">Moria M2</option>
                    <option value="Moria One">Moria One</option>
                    <option value="VisuMax">VisuMax</option>
                  </select>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>Diam</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface, borderRadius: 10, padding: '4px 8px', border: `1px solid ${C.border}` }}>
                    <input 
                      type="number" 
                      step="0.1"
                      value={draft.flapDiam || '8.5'} 
                      onChange={(e) => setDraft({ flapDiam: e.target.value })}
                      style={{ width: '100%', background: 'none', border: 'none', color: C.text, fontSize: 13, fontWeight: 800, fontFamily: F.mono, outline: 'none', textAlign: 'center' }} 
                    />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>Depth</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface, borderRadius: 10, padding: '4px 8px', border: `1px solid ${C.border}` }}>
                    <input 
                      type="number" 
                      step="5"
                      value={draft.capOrFlap || draft.flapDepth || '110'} 
                      onChange={(e) => setDraft({ capOrFlap: e.target.value, flapDepth: e.target.value })}
                      style={{ width: '100%', background: 'none', border: 'none', color: C.indigo, fontSize: 13, fontWeight: 800, fontFamily: F.mono, outline: 'none', textAlign: 'center' }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } catch (err) {
    return <div style={{ padding: 20, color: 'white', background: 'red' }}>MAIN ERROR: {String(err)}</div>;
  }
}

export function PlanTab() {
  try {
    const { draft, setDraft, toggleSurgicalEye } = useSessionStore();
    const { planEye, setPlanEye } = useUIStore();
    const { language } = useClinicStore();
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

    const d = parseDateSafe(draft.date);
    const dateStr = d ? d.toLocaleDateString() : draft.date;

    return (
      <div id="debug-plan-root" style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
        <EyeToggle value={planEye} onChange={setPlanEye} onLongPress={handleLongPressEye} disabledEyes={disabledEyes} />
        
        <div style={{ minHeight: 100 }}>
          {draft.type === 'cataract' ? <CataractPlanTab /> : <RefractionPlanTab />}
        </div>

        <MedDisclaimer />
        
        <div style={{ paddingBottom: 10 }}>
          <button onClick={() => { haptic.light(); setShowCalendar(!showCalendar); }} style={{ width: '100%', background: draft.date ? `${C.green}15` : C.accentLt, border: `1px solid ${draft.date ? C.green : C.accent}40`, borderRadius: 20, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: draft.date ? C.green : C.accent, fontFamily: F.sans, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
            {draft.date ? `SURGERY: ${dateStr}` : 'SCHEDULE SURGERY'}
          </button>
          {showCalendar && <Calendar selectedDate={draft.date || null} onSelect={iso => { haptic.success(); setDraft({ date: iso, status: 'planned', isEnhancement: false }); setShowCalendar(false); }} />}
        </div>
      </div>
    );
  } catch (err) {
    return <div style={{ padding: 20, color: 'white', background: 'red' }}>MAIN ERROR: {String(err)}</div>;
  }
}
