import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { PERIOD_KEYS, PERIOD_LABELS } from '../../../types/results';
import type { PeriodKey } from '../../../types/results';
import { DField } from '../../../ui/DField';
import { WheelField } from '../../../ui/WheelField';
import { EyeToggle } from '../../../ui/EyeToggle';
import { SectionLabel } from '../../../ui/SectionLabel';

// Detect suboptimal outcome for a given period+eye
function isSuboptimal(sph: string | undefined, cyl: string | undefined, va: string | undefined, bcva: string | undefined): boolean {
  const s = parseFloat(sph ?? '') || 0;
  const c = parseFloat(cyl ?? '') || 0;
  const uva = parseFloat(va ?? '') || 0;
  const bva = parseFloat(bcva ?? '') || 0;
  const se = Math.abs(s + c / 2);
  if (se > 0.5) return true;
  if (Math.abs(c) > 0.75) return true;
  if (bva > 0 && uva > 0 && uva < bva * 0.8) return true;
  return false;
}

// Helper for SE calculation
function getSE(sph: any, cyl: any): string {
  const s = parseFloat(String(sph ?? '')) || 0;
  const c = parseFloat(String(cyl ?? '')) || 0;
  const se = s + c / 2;
  return (se >= 0 ? '+' : '') + se.toFixed(2);
}

// Mini comparison row for pre/plan/result table
function CompareRow({ label, pre, plan, result, unit = '', hidePlan = false, color }: {
  label: string;
  pre?: string | number;
  plan?: string | number;
  result?: string | number;
  unit?: string;
  hidePlan?: boolean;
  color?: string;
}) {
  const fmt = (v: string | number | undefined) => {
    if (v === undefined || v === '' || v === null) return '—';
    const n = parseFloat(String(v));
    if (isNaN(n)) return '—';
    if (label.startsWith('K')) return n.toFixed(2);
    if (label === 'VA') return n.toFixed(2);
    return n > 0 ? `+${n.toFixed(2)}` : n === 0 ? '0.00' : n.toFixed(2);
  };
  const fmtRaw = (v: string | number | undefined) => {
    if (v === undefined || v === '') return '—';
    return String(v);
  };
  const isNum = unit !== '°' && unit !== '';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: hidePlan ? '40px 1fr 1fr' : '40px 1fr 1fr 1fr', gap: 4, alignItems: 'center' }}>
      <span style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 800, color: color || C.muted, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted2, textAlign: 'center' }}>{isNum ? fmt(pre) : fmtRaw(pre)}{pre !== undefined && pre !== '' && unit ? ` ${unit}` : ''}</span>
      {!hidePlan && <span style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, textAlign: 'center' }}>{isNum ? fmt(plan) : fmtRaw(plan)}{plan !== undefined && plan !== '' && unit ? ` ${unit}` : ''}</span>}
      <span style={{ fontFamily: F.mono, fontSize: 11, color: color || C.text, fontWeight: 600, textAlign: 'center' }}>{isNum ? fmt(result) : fmtRaw(result)}{result !== undefined && result !== '' && unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

export function ResultTab({ onSave, isSaving }: { onSave: () => void, isSaving: boolean }) {
  const { draft, setPeriodEyeField } = useSessionStore();
  const { activePeriod, setActivePeriod, resultEye, setResultEye, targetSection, setTargetSection, setActiveTab, setEnhancementEye } = useUIStore();

  if (!draft) return null;
  const isCat = draft.type === 'cataract';

  const periodData = draft.periods?.[activePeriod] ?? {};
  const eyeData = periodData[resultEye] ?? {};
  const set = (field: string, value: string) => setPeriodEyeField(activePeriod, resultEye, field as any, value);

  const ec = eyeColors(resultEye);


  // Pre-op refraction for comparison table
  const preEye = draft[resultEye];
  const preSph = preEye?.man_sph ?? '';
  const preCyl = preEye?.man_cyl ?? '';
  const preAx  = preEye?.man_ax ?? '';
  const preK1  = preEye?.k1 ?? '';
  const preK2  = preEye?.k2 ?? '';
  const preKAx = preEye?.kerax ?? '';
  const planEye = draft.savedPlan?.[resultEye] as any;

  // Suboptimal detection for both eyes (best available period)
  const bestPeriod = (['1y','6m','3m','1m','1w','1d'] as PeriodKey[]).find(pk => {
    const d = draft.periods?.[pk];
    return d?.od?.sph || d?.os?.sph;
  }) ?? activePeriod;

  const subOD = isSuboptimal(
    draft.periods?.[bestPeriod]?.od?.sph,
    draft.periods?.[bestPeriod]?.od?.cyl,
    draft.periods?.[bestPeriod]?.od?.va,
    draft.periods?.[bestPeriod]?.od?.bcva,
  );
  const subOS = isSuboptimal(
    draft.periods?.[bestPeriod]?.os?.sph,
    draft.periods?.[bestPeriod]?.os?.cyl,
    draft.periods?.[bestPeriod]?.os?.va,
    draft.periods?.[bestPeriod]?.os?.bcva,
  );
  const hasEnhancement = !!(draft as any).savedEnhancement;
  const showSuboptimal = !isCat && (subOD || subOS) && !hasEnhancement;

  // OU VA fields (same period, both eyes)
  const odData = periodData['od'] ?? {};
  const osData = periodData['os'] ?? {};
  const setODField = (field: string, v: string) => setPeriodEyeField(activePeriod, 'od', field as any, v);
  const setOSField = (field: string, v: string) => setPeriodEyeField(activePeriod, 'os', field as any, v);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Переключатель глаз (всегда сверху) */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle value={resultEye} onChange={setResultEye} />
      </div>

      {/* Pre / Plan / Result comparison (refraction only) */}
      {!isCat && (preSph || planEye) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel color={ec.color}>СРАВНЕНИЕ {resultEye.toUpperCase()}</SectionLabel>
          <div style={{
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '12px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 4 }}>
              <span />
              {(['До', 'План', 'Факт'] as const).map(h => (
                <span key={h} style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 800, color: h === 'Факт' ? C.text : h === 'План' ? C.accent : C.muted, textAlign: 'center', letterSpacing: '.05em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            <CompareRow label="Sph" pre={preSph} plan={planEye?.sph} result={eyeData.sph} unit="D" />
            <CompareRow label="Cyl" pre={preCyl} plan={planEye?.cyl} result={eyeData.cyl} unit="D" />
            <CompareRow label="Ax" pre={preAx} plan={planEye?.ax} result={eyeData.ax} unit="°" />
            <CompareRow label="SE" pre={getSE(preSph, preCyl)} plan={getSE(planEye?.sph, planEye?.cyl)} result={getSE(eyeData.sph, eyeData.cyl)} unit="D" color={C.green} />
          </div>
        </div>
      )}

      {/* Keratometry comparison block */}
      {!isCat && (preK1 || eyeData.k1 || preK2 || eyeData.k2) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel color={ec.color}>КЕРАТОМЕТРИЯ {resultEye.toUpperCase()}</SectionLabel>
          <div style={{
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '12px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', gap: 4 }}>
              <span />
              {(['До', 'Факт'] as const).map(h => (
                <span key={h} style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 800, color: h === 'Факт' ? C.text : C.muted, textAlign: 'center', letterSpacing: '.05em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            <CompareRow label="K1" pre={preK1} result={eyeData.k1} unit="D" hidePlan />
            <CompareRow label="K2" pre={preK2} result={eyeData.k2} unit="D" hidePlan />
            <CompareRow label="Ax K" pre={preKAx} result={eyeData.k_ax} unit="°" hidePlan />
          </div>
        </div>
      )}

      {/* Period strip */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {PERIOD_KEYS.map(p => {
          const active = activePeriod === p;
          const hasDataEye = (e: any) => !!(e?.sph || e?.va || e?.bcva || e?.k1 || e?.k2 || e?.note || e?.cyl);
          const hasData = !!(hasDataEye(draft.periods?.[p]?.od) || hasDataEye(draft.periods?.[p]?.os));
          return (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              style={{
                padding: '6px 14px', borderRadius: 20, flexShrink: 0,
                border: `1.5px solid ${active ? C.accent : hasData ? C.border2 : C.border}`,
                background: active ? C.accentLt : 'transparent',
                color: active ? C.accent : hasData ? C.muted2 : C.muted,
                fontFamily: F.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
                position: 'relative',
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

      {/* Suboptimal banner */}
      {showSuboptimal && (
        <div style={{
          background: 'rgba(251,191,36,.08)', border: `1px solid rgba(251,191,36,.3)`,
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontFamily: F.sans, fontSize: 12, color: C.yellow, fontWeight: 700 }}>
            Субоптимальный результат — рассмотреть докоррекцию
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {subOD && (
              <button
                onClick={() => { setEnhancementEye('od'); setActiveTab('enhancement'); }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 10,
                  background: 'rgba(96,165,250,.12)', border: `1px solid rgba(96,165,250,.3)`,
                  color: C.od, fontFamily: F.sans, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Докоррекция OD →
              </button>
            )}
            {subOS && (
              <button
                onClick={() => { setEnhancementEye('os'); setActiveTab('enhancement'); }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 10,
                  background: 'rgba(52,211,153,.12)', border: `1px solid rgba(52,211,153,.3)`,
                  color: C.os, fontFamily: F.sans, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Докоррекция OS →
              </button>
            )}
          </div>
        </div>
      )}

      {/* OU VA overview (both eyes at a glance) */}
      {!isCat && (
        <div>
          <SectionLabel>ОСТРОТА ЗРЕНИЯ OU</SectionLabel>
          <DField 
            label="UVA OU" 
            value={odData.ou_va || osData.ou_va || ''} 
            onChange={v => { 
              setODField('ou_va', v); 
              setOSField('ou_va', v); 
            }} 
            placeholder="1.0" 
            accentColor={C.accent} 
          />
        </div>
      )}


      {/* Result input fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionLabel 
          color={ec.color}
          active={targetSection === 'result_refraction'}
          onClick={() => setTargetSection(targetSection === 'result_refraction' ? null : 'result_refraction')}
        >
          ВВОД ДАННЫХ {isCat ? '' : resultEye.toUpperCase()}
        </SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <DField label="UVA" value={eyeData.va ?? ''} onChange={v => set('va', v)} placeholder="0.1" accentColor={ec.color} />
          <DField label="BCVA" value={eyeData.bcva ?? ''} onChange={v => set('bcva', v)} placeholder="1.0" accentColor={C.green} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <WheelField label="Sph" value={eyeData.sph ?? '0.00'} onChange={v => set('sph', v)} min={-10} max={6} step={0.25} accentColor={ec.color} />
          <WheelField label="Cyl" value={eyeData.cyl ?? '0.00'} onChange={v => set('cyl', v)} min={-6} max={6} step={0.25} />
          <DField label="Ось °" value={eyeData.ax ?? ''} onChange={v => set('ax', v)} type="number" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <DField label="K1" value={eyeData.k1 ?? ''} onChange={v => set('k1', v)} type="number" unit="D" step=".01" />
          <DField label="K2" value={eyeData.k2 ?? ''} onChange={v => set('k2', v)} type="number" unit="D" step=".01" />
          <DField label="Ось K °" value={eyeData.k_ax ?? ''} onChange={v => set('k_ax', v)} type="number" />
        </div>

        <DField label="Примечание" value={eyeData.note ?? ''} onChange={v => set('note', v)} type="text" placeholder="Заметки..." />
      </div>

      {/* Period history minimap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SectionLabel>История периодов</SectionLabel>
        {PERIOD_KEYS.map(pk => {
          const pd = draft.periods?.[pk]?.[resultEye];
          if (!pd?.sph && !pd?.va && !pd?.bcva && !pd?.k1 && !pd?.k2 && !pd?.note && !pd?.cyl) return null;
          const sph = parseFloat(pd.sph ?? '');
          const sub = isSuboptimal(pd.sph, pd.cyl, pd.va, pd.bcva);
          return (
            <div
              key={pk}
              onClick={() => setActivePeriod(pk)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: activePeriod === pk ? C.accentLt : C.surface2,
                border: `1px solid ${activePeriod === pk ? C.accent + '40' : sub ? 'rgba(251,191,36,.25)' : C.border}`,
                borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: F.sans, fontSize: 12, color: C.muted }}>{PERIOD_LABELS[pk]}</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {sub && <span style={{ fontSize: 9, color: C.yellow }}>!</span>}
                {pd.va && <span style={{ fontFamily: F.mono, fontSize: 12, color: C.text }}>VA {pd.va}</span>}
                {pd.bcva && pd.bcva !== pd.va && <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted2 }}>/{pd.bcva}</span>}
                
                <span style={{ fontFamily: F.mono, fontSize: 12, color: ec.color, fontWeight: 600 }}>
                  {!isNaN(sph) && (sph >= 0 ? '+' : '') + sph.toFixed(2)}
                  {pd.cyl && ` ${parseFloat(pd.cyl) >= 0 ? '+' : ''}${parseFloat(pd.cyl).toFixed(2)}`}
                  {pd.ax && ` ×${pd.ax}°`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Кнопка окончательного сохранения */}
      <div style={{ padding: '24px 0 10px' }}>
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${C.green} 0%, #10B981 100%)`,
            border: 'none',
            borderRadius: 20,
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: '#fff',
            fontFamily: F.sans,
            fontSize: 15,
            fontWeight: 800,
            boxShadow: `0 8px 16px ${C.green}30`,
            cursor: 'pointer',
            transition: 'all 0.2s',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            'СОХРАНЕНИЕ...'
          ) : (
            <>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              ЗАВЕРШИТЬ И СОХРАНИТЬ
            </>
          )}
        </button>
        <p style={{
          textAlign: 'center',
          fontFamily: F.sans,
          fontSize: 10,
          color: C.muted,
          marginTop: 10,
          letterSpacing: '.02em'
        }}>
          После нажатия случай попадет в общую статистику хирурга
        </p>
      </div>

    </div>
  );
}
