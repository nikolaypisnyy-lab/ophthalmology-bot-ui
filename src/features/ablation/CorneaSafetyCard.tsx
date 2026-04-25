import React from 'react';
import { C, F, R } from '../../constants/design';

interface CorneaSafetyCardProps {
  eye: 'od' | 'os';
  cct: number;
  flap: number;
  abl: number;
  rsb: number;
  pta: number;
  kpost: number;
  kpre?: number;
  isWarnRSB?: boolean;
}

export function CorneaSafetyCard({ 
  eye, cct, flap, abl, rsb, pta, kpost, kpre, isWarnRSB 
}: CorneaSafetyCardProps) {
  const eyeColor = eye === 'od' ? C.od : C.os;
  const isDangerRSB = rsb < 300;
  const isWarnPTA = pta >= 40;
  
  const rsbColor = isDangerRSB ? C.red : (rsb < 380 ? C.yellow : C.green);
  const ptaColor = isWarnPTA ? C.red : C.green;

  // Percentage for progress bars
  const ablPct = Math.min(100, (abl / 150) * 100);
  const rsbPct = Math.min(100, (rsb / 550) * 100);
  const ptaPct = Math.min(100, (pta / 50) * 100);
  const kpostPct = Math.min(100, ((kpost - 30) / 20) * 100);

  return (
    <div style={{
      background: `linear-gradient(180deg, ${C.surface2} 0%, ${C.surface} 100%)`,
      border: `1px solid ${isWarnRSB ? `${C.yellow}40` : 'rgba(129, 140, 248, 0.15)'}`,
      borderRadius: '16px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    }}>
      {/* Header with Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.indigo }}>
          Ablation profile · Safety
        </span>
        {isWarnRSB && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(245, 158, 11, 0.12)', border: `1px solid ${C.yellow}40`,
            padding: '4px 8px', borderRadius: '6px',
            color: C.yellow, fontFamily: F.mono, fontSize: '10px', fontWeight: 700
          }}>
            <span style={{ 
              width: '6px', height: '6px', background: C.yellow, borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }} />
            RSB LOW
          </div>
        )}
      </div>

      {/* Corneal Stack Viz */}
      <div style={{
        background: '#05060c', border: `1px solid ${C.border}`,
        borderRadius: '12px', padding: '16px 14px 12px',
        position: 'relative'
      }}>
        <div style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted2, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Corneal stack · CCT {cct} µm
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Flap Layer (Blue, only if > 0) */}
          {flap > 0 && (
            <div style={{
              height: '26px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 12px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6',
              fontFamily: F.mono, fontSize: '10px', fontWeight: 700, border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '9px' }}>Flap / Cap</span>
              <span>{flap} µm</span>
            </div>
          )}

          {/* Ablation Layer (HIGH VISIBILITY YELLOW) */}
          <div style={{
            height: '22px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', background: 'rgba(251, 191, 36, 0.25)', border: '1px solid rgba(251, 191, 36, 0.4)',
            color: '#fbbf24', fontFamily: F.mono, fontSize: '11px', fontWeight: 900,
            boxShadow: '0 0 15px rgba(251, 191, 36, 0.15)',
            textShadow: '0 0 8px rgba(251, 191, 36, 0.3)'
          }}>
            <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '9px' }}>Ablation</span>
            <span>{abl} µm · PTA {pta}%</span>
          </div>

          {/* RSB Layer */}
          <div style={{
            height: '48px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', background: isDangerRSB ? 'rgba(239, 68, 68, 0.25)' : (rsb < 380 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)'), 
            border: `1px solid ${isDangerRSB ? 'rgba(239, 68, 68, 0.4)' : (rsb < 380 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)')}`,
            color: rsbColor, fontFamily: F.mono, fontSize: '10px', fontWeight: 900
          }}>
            <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '9.5px' }}>RSB · Residual Stroma</span>
            <span style={{ fontSize: '12px' }}>{rsb} µm</span>
          </div>
        </div>

        {/* Footer info inside viz */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: F.mono, fontSize: '8.5px', color: C.muted, textTransform: 'uppercase' }}>Pre-op CCT</span>
            <span style={{ fontFamily: F.mono, fontSize: '12px', color: C.text }}>{cct} µm</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontFamily: F.mono, fontSize: '8.5px', color: C.muted, textTransform: 'uppercase' }}>Post-op K</span>
            <span style={{ fontFamily: F.mono, fontSize: '12px', color: C.text }}>{kpost.toFixed(2)} D</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontFamily: F.mono, fontSize: '8.5px', color: C.muted, textTransform: 'uppercase' }}>{flap > 0 ? 'Combined' : 'Total Abl'}</span>
            <span style={{ fontFamily: F.mono, fontSize: '12px', color: C.text }}>{flap + abl} µm</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid with Progress Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <MetricCard label="ABL" value={abl} unit="µm" sub={`per diopter ~${(abl/10 || 14).toFixed(0)}µm`} pct={ablPct} color="#fbbf24" />
        <MetricCard label="RSB" value={rsb} unit="µm" sub="min 300 · target 380+" color={rsbColor} pct={rsbPct} mark={300/5.5} />
        <MetricCard label="PTA" value={pta} unit="%" sub="limit 40% · ectasia" color={ptaColor} pct={ptaPct} mark={80} />
        <MetricCard label="K-post" value={kpost.toFixed(2)} unit="D" sub={kpre ? `Δ from ${kpre.toFixed(2)}` : 'corneal k'} pct={kpostPct} barColor={C.indigo} />
      </div>

      {isWarnRSB && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)', border: `1px solid ${C.yellow}40`,
          borderRadius: '12px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start'
        }}>
          <span style={{ color: C.yellow, fontSize: '16px' }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: C.yellow, marginBottom: '2px' }}>RSB below comfort zone</div>
            <div style={{ fontFamily: F.mono, fontSize: '10px', color: C.muted2, lineHeight: 1.4 }}>
              {rsb} µm is safe but tight. Consider reducing OZ or switching to surface ablation (PRK) to spare stromal bed.
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function MetricCard({ label, value, unit, sub, pct, color = C.text, barColor, mark }: any) {
  const isABL = label === 'ABL';
  const finalBarColor = barColor || (color === C.text ? C.indigo : color);
  
  return (
    <div style={{
      background: '#05060c', 
      border: `1px solid ${isABL ? 'rgba(251, 191, 36, 0.3)' : C.border}`,
      borderRadius: '11px', padding: '10px 12px', position: 'relative',
      boxShadow: isABL ? '0 0 20px rgba(251, 191, 36, 0.08)' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: F.mono, fontSize: '9px', fontWeight: 700, color: C.muted2, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted }}>{unit}</span>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: '20px', fontWeight: 500, color: color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontFamily: F.mono, fontSize: '9px', color: C.muted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{sub}</div>
      
      <div style={{ marginTop: '8px', height: '3px', background: C.surface3, borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: finalBarColor, borderRadius: '2px' }} />
        {mark && <div style={{ position: 'absolute', left: `${mark}%`, top: 0, width: '1px', height: '100%', background: C.border }} />}
      </div>
    </div>
  );
}
