import { C, F } from '../../constants/design';
import { useClinicStore } from '../../store/useClinicStore';
import { T } from '../../constants/translations';

interface CorneaSafetyCardProps {
  eye: 'od' | 'os';
  cct: number;
  flap: number;
  abl: number;
  rsb: number;
  pta: number;
  kpost: number;
  kpre?: number;
  isPRK?: boolean;
  effectiveFlap?: number;
}

export function CorneaSafetyCard({ 
  eye, cct, flap, abl, rsb, pta, kpost, kpre, isPRK, effectiveFlap 
}: CorneaSafetyCardProps) {
  const { language } = useClinicStore();
  const t = T(language);
  
  const layerValue = effectiveFlap || flap;
  const layerLabel = isPRK ? 'EPITHELIUM' : t.flap.toUpperCase();

  const isDangerRSB = rsb < 300;
  const isWarnPTA = pta >= 40;
  const isWarnRSB = rsb < 320;
  
  const rsbColor = isDangerRSB ? C.red : (rsb < 320 ? C.warn : C.green);
  const ptaColor = isWarnPTA ? C.red : C.green;

  // Percentage for progress bars
  const ablPct = Math.min(100, (abl / 150) * 100);
  const rsbPct = Math.min(100, (rsb / 550) * 100);
  const ptaPct = Math.min(100, (pta / 50) * 100);
  
  // DEFENSIVE: Handle NaN or undefined kpost
  const kpostVal = isNaN(kpost) ? 0 : kpost;
  const kpostPct = Math.min(100, ((kpostVal - 30) / 20) * 100);

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${isWarnRSB ? `${C.warn}40` : 'rgba(129, 140, 248, 0.15)'}`,
      borderRadius: '24px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.indigo }}>
          {t.ablationProfile} · {activeEyeLabel(eye)}
        </span>
        {isWarnRSB && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(245, 158, 11, 0.12)', border: `1px solid ${C.warn}40`,
            padding: '4px 8px', borderRadius: '8px',
            color: C.warn, fontFamily: F.mono, fontSize: '10px', fontWeight: 900
          }}>
            <span style={{ width: '6px', height: '6px', background: C.warn, borderRadius: '50%' }} />
            RSB LOW
          </div>
        )}
      </div>

      <div style={{
        background: C.surface, border: `1px solid ${C.border}80`,
        borderRadius: '16px', padding: '16px 14px 14px',
      }}>
        <div style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted2, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.04em' }}>
          Corneal stack · CCT {cct} µm
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{
            height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', background: isPRK ? 'rgba(129, 140, 248, 0.12)' : 'rgba(59, 130, 246, 0.15)', 
            color: isPRK ? C.indigo : '#3b82f6',
            fontFamily: F.mono, fontSize: '11px', fontWeight: 700, border: `1px solid ${isPRK ? `${C.indigo}40` : 'rgba(59, 130, 246, 0.3)'}`
          }}>
            <span>{layerLabel}</span>
            <span>{layerValue} µm</span>
          </div>

          <div style={{
            height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', background: 'rgba(251, 191, 36, 0.2)', border: '1px solid rgba(251, 191, 36, 0.4)',
            color: '#fbbf24', fontFamily: F.mono, fontSize: '12px', fontWeight: 900,
          }}>
            <span>{t.ablation.toUpperCase()}</span>
            <span>{abl} µm</span>
          </div>

          <div style={{
            height: '40px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', background: isDangerRSB ? 'rgba(239, 68, 68, 0.2)' : (rsb < 320 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'), 
            border: `1px solid ${rsbColor}40`, color: rsbColor, fontFamily: F.mono, fontSize: '11px', fontWeight: 900
          }}>
            <span>{t.rsb.toUpperCase()}</span>
            <span style={{ fontSize: '16px' }}>{rsb} µm</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
          <StackStat label="PRE-OP CCT" val={`${cct} µm`} />
          <StackStat label="POST-OP K" val={`${kpostVal.toFixed(2)} D`} />
          <StackStat label="TOTAL REMOVED" val={`${layerValue + abl} µm`} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <MetricCard label={t.ablation} value={abl} unit="µm" pct={ablPct} color="#fbbf24" />
        <MetricCard label={t.rsb} value={rsb} unit="µm" color={rsbColor} pct={rsbPct} />
        <MetricCard label={t.pta} value={pta} unit="%" color={ptaColor} pct={ptaPct} />
        <MetricCard label={t.kPost} value={kpostVal.toFixed(2)} unit="D" pct={kpostPct} barColor={C.indigo} />
      </div>
    </div>
  );
}

function activeEyeLabel(eye: string) {
  return eye.toUpperCase();
}

function StackStat({ label, val }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: F.mono, fontSize: '7.5px', color: C.muted, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: F.mono, fontSize: '11px', color: C.text, fontWeight: 700 }}>{val}</span>
    </div>
  );
}

function MetricCard({ label, value, unit, pct, color = C.text, barColor }: any) {
  const finalBarColor = barColor || (color === C.text ? C.indigo : color);
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}80`,
      borderRadius: '12px', padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: F.mono, fontSize: '8px', fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: F.mono, fontSize: '8px', color: C.muted }}>{unit}</span>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: '18px', fontWeight: 700, color: color }}>{value}</div>
      <div style={{ marginTop: '8px', height: '3px', background: C.surface3, borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: finalBarColor }} />
      </div>
    </div>
  );
}
