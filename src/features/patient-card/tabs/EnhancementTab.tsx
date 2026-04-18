import { useEffect, useState, useRef } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { Calendar } from '../../../ui/Calendar';
import { SectionLabel } from '../../../ui/SectionLabel';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { LASERS } from '../../../constants/lasers';
import { computeRefPlan } from '../../../calculators/refraction';
import { computeRefStats, rsbLevel, ptaLevel, kpostLevel, ablLevel } from '../../../calculators/refStats';
import { DField } from '../../../ui/DField';
import { WheelField } from '../../../ui/WheelField';
import { EyeToggle } from '../../../ui/EyeToggle';
import { Chip } from '../../../ui/Chip';
import { newEyeData } from '../../../types/refraction';

const EXCIMER_LASERS = LASERS.filter(l => ['visx_s4ir', 'ex500', 'mel90'].includes(l.id));

function EnhancementResult({ eye, onReset }: { eye: 'od' | 'os'; onReset: () => void }) {
  const { draft, refPlan, enhancementPlan, setEnhancementField, setDraft } = useSessionStore();
  const ec = eyeColors(eye);
  const plan = enhancementPlan?.[eye];
  const primaryPlan = refPlan?.[eye] || draft?.savedPlan?.[eye];

  if (!plan) return (
    <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontFamily: F.sans, fontSize: 13 }}>
      Введите остаточную рефракцию для расчёта
    </div>
  );

  const laser = draft?.laser ?? 'ex500';
  const eyeData = draft?.[eye] ?? newEyeData();
  const oz = draft?.oz ?? '6.5';
  const capOrFlap = draft?.capOrFlap ?? '110';
  const minTh = draft?.minTh ?? '15';

  let primaryStats = {
    abl: 0,
    rsb: parseFloat(String(eyeData.cct)) || 0,
    pta: '0',
    kpost: (parseFloat(String(eyeData.k1)) + parseFloat(String(eyeData.k2))) / 2 || parseFloat(String(eyeData.kavg)) || 0,
  };

  if (primaryPlan) {
    const pStats = computeRefStats(
      primaryPlan.sph, primaryPlan.cyl, oz,
      LASERS.find(l => l.id === draft?.laser)?.isLenticule ?? false,
      eyeData.cct, capOrFlap, minTh,
      eyeData.k1, eyeData.k2, eyeData.kavg,
      draft?.laser as any,
    );
    primaryStats = {
      abl: pStats.abl,
      rsb: pStats.rsb ?? primaryStats.rsb,
      pta: pStats.pta ?? '0',
      kpost: parseFloat(pStats.kpost ?? String(primaryStats.kpost)),
    };
  }

  const enhStats = computeRefStats(
    plan.sph, plan.cyl, oz, false,
    primaryStats.rsb, 0, 0,
    primaryStats.kpost, primaryStats.kpost, primaryStats.kpost,
    laser as any,
  );

  const cumulativeStats = {
    abl: enhStats.abl,
    rsb: enhStats.rsb,
    pta: (((parseFloat(capOrFlap) + primaryStats.abl + enhStats.abl) / (parseFloat(eyeData.cct) || 1)) * 100).toFixed(1),
    kpost: enhStats.kpost,
  };

  const fmt = (v: number | null, dec = 2) => {
    if (v === null || isNaN(v)) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(dec);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* План докоррекции */}
      <div style={{
        background: C.surface2, border: `1px solid ${C.border}`,
        borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SectionLabel color={ec.color} style={{ marginBottom: 0 }}>ПЛАН ДОКОРРЕКЦИИ</SectionLabel>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setDraft({ doRound: !draft?.doRound })}
                style={{
                  padding: '0 8px', height: 20, borderRadius: 20,
                  background: draft?.doRound ? `${C.accent}20` : 'transparent',
                  border: `1px solid ${draft?.doRound ? C.accent : 'transparent'}`,
                  color: draft?.doRound ? C.accent : C.muted2,
                  fontFamily: F.sans, fontSize: 9, fontWeight: 700,
                  cursor: 'pointer', transition: 'all .2s'
                }}
              >
                ОКРУГЛЯТЬ 0.25
              </button>
              <button
                onClick={onReset}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: C.muted2, background: 'transparent',
                  border: 'none', padding: 0
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <WheelField
              label="SPH"
              value={String(plan.sph.toFixed(2))}
              onChange={v => setEnhancementField(eye, 'sph', parseFloat(v) || 0)}
              min={-14} max={6} step={0.25}
              accentColor={ec.color} accentText={true}
            />
            <WheelField
              label="CYL"
              value={String(plan.cyl.toFixed(2))}
              onChange={v => setEnhancementField(eye, 'cyl', parseFloat(v) || 0)}
              min={-6} max={0} step={0.25}
              accentColor={ec.color} accentText={true}
            />
            <DField
              label="AX"
              value={String(plan.ax)}
              onChange={v => setEnhancementField(eye, 'ax', parseFloat(v) || 0)}
              type="number"
              accentColor={ec.color} textColor={C.text}
            />
          </div>

          {/* Индикаторы безопасности */}
          <div style={{
            background: C.surface3, border: `1px solid ${C.border}`,
            borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
                <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { label: 'ABL', value: cumulativeStats.abl, unit: 'мкм', level: ablLevel(cumulativeStats.abl) },
                { label: 'RSB', value: cumulativeStats.rsb, unit: 'мкм', level: rsbLevel(cumulativeStats.rsb) },
                { label: 'PTA', value: cumulativeStats.pta, unit: '%',   level: ptaLevel(cumulativeStats.pta) },
                { label: 'KPOST', value: cumulativeStats.kpost, unit: 'D', level: kpostLevel(cumulativeStats.kpost) },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>{s.label}</div>
                  <div style={{
                    fontFamily: F.mono, fontSize: 13, fontWeight: 800,
                    color: s.level === 'red' ? C.red : s.level === 'yellow' ? C.yellow : C.green,
                  }}>
                    {s.value} <span style={{ fontSize: 8, fontWeight: 400, color: C.muted }}>{s.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Сравнение с первичной операцией */}
          {primaryPlan && (
            <div style={{
              background: C.surface3, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '8px 12px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            }}>
              <div style={{ fontFamily: F.sans, fontSize: 9, color: C.muted, fontWeight: 600 }}>Первичная абляция</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, textAlign: 'right' }}>{fmt(primaryStats.abl, 0)} мкм</div>
              <div style={{ fontFamily: F.sans, fontSize: 9, color: C.muted, fontWeight: 600 }}>RSB после докоррекции</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: rsbLevel(cumulativeStats.rsb) === 'red' ? C.red : rsbLevel(cumulativeStats.rsb) === 'yellow' ? C.yellow : C.green, textAlign: 'right', fontWeight: 700 }}>{cumulativeStats.rsb} мкм</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EnhancementTab() {
  const { draft, setDraft, enhancementPlan, setEnhancementPlan, setEyeField } = useSessionStore();
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCalendar && calendarRef.current) {
      setTimeout(() => {
        calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [showCalendar]);
  const { enhancementEye, setEnhancementEye } = useUIStore();

  if (!draft) return null;

  const laser = draft.laser ?? 'ex500';
  const eyeData = draft[enhancementEye] ?? newEyeData();
  const residualKey = `residual_${enhancementEye}` as 'residual_od' | 'residual_os';
  const residual: any = draft[residualKey] ?? { sph: '', cyl: '', ax: '', k1: '', k2: '' };
  const ec = eyeColors(enhancementEye);

  const getLatestK = (eye: 'od' | 'os') => {
    const periods = ['1y', '6m', '3m', '1m', '1w', '1d'] as const;
    for (const p of periods) {
      const pData = (draft.periods as any)?.[p]?.[eye];
      if (pData?.k1 || pData?.k2) return { k1: pData.k1 || '', k2: pData.k2 || '' };
    }
    return { k1: draft[eye]?.k1 || '', k2: draft[eye]?.k2 || '' }; // Fallback to pre-op
  };

  const getLatestRef = (eye: 'od' | 'os') => {
    const fmt = (v: string | number) => {
      const n = parseFloat(String(v));
      if (isNaN(n)) return '';
      return n > 0 ? `+${n.toFixed(2)}` : n === 0 ? '0.00' : n.toFixed(2);
    };
    const periods = ['1y', '6m', '3m', '1m', '1w', '1d'] as const;
    for (const p of periods) {
      const pData = (draft.periods as any)?.[p]?.[eye];
      if (pData?.sph !== undefined && pData?.sph !== '') return { sph: fmt(pData.sph), cyl: fmt(pData.cyl || '0.00'), ax: pData.ax || '0' };
    }
    return { sph: '', cyl: '', ax: '' }; 
  };

  const latestRef = getLatestRef(enhancementEye);
  const enhSph = residual.sph !== undefined && residual.sph !== '' ? residual.sph : latestRef.sph;
  const enhCyl = residual.cyl !== undefined && residual.cyl !== '' ? residual.cyl : latestRef.cyl;
  const enhAx  = residual.ax  !== undefined && residual.ax  !== '' ? residual.ax  : latestRef.ax;

  const enhK1 = residual.k1 || getLatestK(enhancementEye).k1;
  const enhK2 = residual.k2 || getLatestK(enhancementEye).k2;

  const setResidual = (patch: any) => {
    setDraft({ [residualKey]: { ...residual, ...patch } });
  };

  const recalc = () => {
    const age = parseFloat(draft.age ?? '0') || 0;
    const fakeEyeData = (eye: 'od' | 'os') => {
      const res: any = draft[`residual_${eye}` as 'residual_od' | 'residual_os'] ?? {};
      const latestK = getLatestK(eye);
      const latestR = getLatestRef(eye);
      return {
        ...newEyeData(),
        man_sph: res.sph !== undefined && res.sph !== '' ? res.sph : (latestR.sph || '0.00'),
        man_cyl: res.cyl !== undefined && res.cyl !== '' ? res.cyl : (latestR.cyl || '0.00'),
        man_ax:  res.ax  !== undefined && res.ax  !== '' ? res.ax  : (latestR.ax  || '0'),
        cct:  draft[eye]?.cct  || '',
        k1:   res.k1 || latestK.k1,
        k2:   res.k2 || latestK.k2,
        kavg: '',
      };
    };
    setEnhancementPlan({
      od: computeRefPlan(fakeEyeData('od') as any, laser as any, false, !!draft.doRound, age, !!draft.noNomogram) ?? undefined,
      os: computeRefPlan(fakeEyeData('os') as any, laser as any, false, !!draft.doRound, age, !!draft.noNomogram) ?? undefined,
    });
  };

  useEffect(() => {
    if (!enhancementPlan) recalc();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px' }}>

      {/* Лазер */}
      <div style={{
        background: C.surface2, border: `1px solid ${C.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 800, color: C.muted, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>ЛАЗЕР (ЭКСИМЕР)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {EXCIMER_LASERS.map(l => (
              <Chip
                key={l.id}
                label={l.shortLabel}
                active={laser === l.id}
                color={l.color}
                onClick={() => setDraft({ laser: l.id })}
                style={{ width: '100%', justifyContent: 'center', height: 22, fontSize: 8, padding: '0 4px' }}
              />
            ))}
            <Chip
              label="Без ном."
              active={!!draft.noNomogram}
              color={C.red}
              onClick={() => setDraft({ noNomogram: !draft.noNomogram })}
              style={{ width: '100%', justifyContent: 'center', height: 22, fontSize: 8, padding: '0 4px' }}
            />
          </div>
        </div>
      </div>

      {/* Остаточная рефракция + кератометрия */}
      <div style={{
        background: C.surface2, border: `1px solid ${C.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 800, color: C.muted, letterSpacing: '.07em', textTransform: 'uppercase' }}>ОСТАТОЧНАЯ РЕФРАКЦИЯ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <DField label="SPH" value={enhSph} onChange={v => setResidual({ sph: v })} type="text" placeholder="0.00" accentColor={ec.color} textColor={C.text} />
            <DField label="CYL" value={enhCyl} onChange={v => setResidual({ cyl: v })} type="text" placeholder="0.00" accentColor={ec.color} textColor={C.text} />
            <DField label="AX"  value={enhAx}  onChange={v => setResidual({ ax: v })}  type="text" placeholder="0"    accentColor={ec.color} textColor={C.text} />
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <div style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 800, color: C.muted, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>КЕРАТОМЕТРИЯ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <DField label="K1 D"   value={enhK1}   onChange={v => setResidual({ k1: v })} type="text" placeholder="43.00" accentColor={ec.color} textColor={C.text} />
              <DField label="K2 D"   value={enhK2}   onChange={v => setResidual({ k2: v })} type="text" placeholder="44.00" accentColor={ec.color} textColor={C.text} />
              <DField label="OZ мм"  value={draft.oz ?? '6.5'} onChange={v => setDraft({ oz: v })}             type="number" step=".1" accentColor={ec.color} textColor={C.text} />
            </div>
          </div>
        </div>
      </div>

      {/* Eye toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
        <EyeToggle value={enhancementEye} onChange={setEnhancementEye} />
      </div>

      <EnhancementResult eye={enhancementEye} onReset={recalc} />

      {/* Кнопка записи на операцию */}
      <div style={{ padding: '12px 0 24px 0' }}>
        <button onClick={() => setShowCalendar(v => !v)} style={{
          width: '100%', background: draft.date ? `${C.green}15` : C.accentLt,
          border: `1px solid ${draft.date ? C.green : C.accent}40`,
          borderRadius: 20, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          color: draft.date ? '#10B981' : C.accent, fontFamily: F.sans, fontSize: 13, fontWeight: 800,
          boxShadow: `0 4px 12px ${draft.date ? C.green : C.accent}15`,
          cursor: 'pointer', transition: 'all 0.2s'
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {draft.date 
            ? (draft.isEnhancement ? `ДОКОРРЕКЦИЯ: ${new Date(draft.date).toLocaleDateString('ru-RU')}` : `ОПЕРАЦИЯ: ${new Date(draft.date).toLocaleDateString('ru-RU')}`)
            : 'ЗАПИСАТЬ НА ДОКОРРЕКЦИЮ'}
        </button>

        {showCalendar && (
          <div ref={calendarRef} style={{ animation: 'fadeIn .2s ease' }}>
            <Calendar 
              selectedDate={draft.date || null} 
              onSelect={(isoDate) => { 
                setDraft({ date: isoDate, status: 'planned', isEnhancement: true }); 
                setTimeout(() => setShowCalendar(false), 200); 
              }} 
            />
          </div>
        )}
      </div>

    </div>
  );
}
