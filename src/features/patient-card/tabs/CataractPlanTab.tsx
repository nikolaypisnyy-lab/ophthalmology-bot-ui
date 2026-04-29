import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { SectionLabel } from '../../../ui';
import { ToricSchematic } from '../../../ui/ToricSchematic';
import { T } from '../../../constants/translations';

export function CataractPlanTab() {
  const { draft, iolResult, toricResults } = useSessionStore();
  const { planEye } = useUIStore();
  const { language } = useClinicStore();
  const t = T(language);

  if (!draft) return null;
  const ec = eyeColors(planEye);
  const r = (iolResult as any)?.[planEye];
  const eyeData = (draft[`bio_${planEye}`] as any) || {};

  const incisionAx = parseInt((draft as any).incAx ?? draft.siaAx ?? '90') || 90;
  const k1 = parseFloat(eyeData.k1 || '0');
  const k2 = parseFloat(eyeData.k2 || '0');
  const k1Ax = parseFloat(eyeData.k_ax || '0');
  const steepAx = k2 > k1 ? (k1Ax + 90) % 180 : k1Ax;

  const toricOn = !!(draft as any).toricMode;
  const toric = toricResults?.[planEye];
  const toricAx = toric?.total_steep_axis ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* TORIC STATUS ROW */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', 
        background: toricOn ? `${C.amber}15` : `${C.surface}80`, 
        borderRadius: 16, border: `1px solid ${toricOn ? `${C.amber}40` : C.border}`,
        boxShadow: toricOn ? `0 4px 15px ${C.amber}20` : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: toricOn ? C.amber : C.muted3 }} />
        <span style={{ fontSize: 11, fontWeight: 900, color: toricOn ? C.amber : C.muted3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Toric IOL {toricOn ? 'ON' : 'OFF'}
        </span>
        {toricOn && toric && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 900, color: C.amber, fontFamily: F.mono }}>
            {toric.best_model} @ {toric.total_steep_axis}°
          </span>
        )}
      </div>

      {/* IMPLANTATION SCHEMATIC */}
      {toricOn && (
        <div style={{
          background: C.card, borderRadius: 28, padding: '16px 16px', border: `1px solid ${C.border}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)', position: 'relative'
        }}>
          <SectionLabel color={C.amber} style={{ marginBottom: 12, textAlign: 'center', fontSize: 11, letterSpacing: '0.12em' }}>
            {t.implantPlane.toUpperCase()}
          </SectionLabel>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <ToricSchematic
              eye={planEye}
              incisionAx={incisionAx}
              toricAx={toricAx}
              steepAx={steepAx}
              size={280}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <Metric label="INCISION" val={`${incisionAx}°`} color={C.indigo} />
            <Metric label="STEEP K" val={`${Math.round(steepAx)}°`} color={C.red} />
            <Metric label="IOL AXIS" val={toricAx != null ? `${Math.round(toricAx)}°` : '—'} color={C.amber} />
          </div>
        </div>
      )}

      {/* LENS SUMMARY */}
      <div style={{
        background: C.card, borderRadius: 28, padding: '24px 18px', border: `1px solid ${C.border}`,
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${ec.color}, ${C.indigo})` }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>SELECTED MODEL</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{(iolResult as any)?.lens || t.noLens}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: ec.color, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>POWER</div>
            <div style={{ fontFamily: F.mono, fontSize: 32, fontWeight: 900, color: ec.color }}>
              {r?.selectedPower ? r.selectedPower.toFixed(2) : ((iolResult as any)?.power || '—')}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Metric label={t.target} val={draft.targetRefr || '0.00'} color={ec.color} />
          <Metric label="SIA" val={draft.sia || '0.10'} color={C.indigo} />
          <Metric label="PRED. SE" val={r?.expectedRefr != null ? (r.expectedRefr > 0 ? '+' : '') + r.expectedRefr.toFixed(2) : '—'} color={C.green} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, val, color }: any) {
  return (
    <div style={{ background: `${C.surface}60`, borderRadius: 16, padding: '12px 4px', border: `1px solid ${C.border}60`, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 900, color: color }}>{val}</div>
    </div>
  );
}
