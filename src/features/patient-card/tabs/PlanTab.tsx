import { useEffect, useState, useRef } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { Calendar } from '../../../ui/Calendar';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { LASERS } from '../../../constants/lasers';
import { computeRefPlan } from '../../../calculators/refraction';
import { computeRefStats, rsbLevel, ptaLevel, kpostLevel, ablLevel } from '../../../calculators/refStats';
import { DField } from '../../../ui/DField';
import { WheelField } from '../../../ui/WheelField';
import { EyeToggle } from '../../../ui/EyeToggle';
import { SectionLabel } from '../../../ui/SectionLabel';
import { Chip } from '../../../ui/Chip';
import { newEyeData } from '../../../types/refraction';
import { AblationViz } from '../../ablation/AblationViz';
import { ToricSchematic } from '../../../ui/ToricSchematic';

// ── Вспомогательные компоненты ───────────────────────────────────────────────

// ── Результат плана для одного глаза ─────────────────────────────────────────

function PlanResult({ eye, onReset, laser }: { eye: 'od' | 'os'; onReset: () => void; laser: string }) {
  const { draft, refPlan, setPlanField, setDraft, setPlanTweaked } = useSessionStore();
  const ec = eyeColors(eye);
  const plan = refPlan?.[eye];

  if (!plan) return (
    <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontFamily: F.sans, fontSize: 13 }}>
      Недостаточно данных для расчёта
    </div>
  );

  const eyeData = draft?.[eye] ?? newEyeData();

  // Показатели безопасности
  const oz = draft?.oz ?? '6.5';
  const capOrFlap = draft?.capOrFlap ?? '110';
  const minTh = draft?.minTh ?? '15';
  const laserCfg = LASERS.find(l => l.id === laser);
  const isLenticule = laserCfg?.isLenticule ?? false;

  const stats = computeRefStats(
    plan.sph, plan.cyl, oz, isLenticule,
    eyeData.cct, capOrFlap, minTh,
    eyeData.k1, eyeData.k2, eyeData.kavg,
    laser as any,
  );

  const handleReset = () => onReset();

  const fmt = (v: number | null, dec = 2) => {
    if (v === null || isNaN(v)) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(dec);
  };

  const vizData = {
    sph: parseFloat(String(plan.sph)) || 0,
    cyl: parseFloat(String(plan.cyl)) || 0,
    axis: parseFloat(String(plan.ax)) || 0,
    opticalZone: parseFloat(String(oz)) || 6.5,
    preOpPachymetry: parseFloat(String(eyeData.cct)) || 550,
    trueAbl: parseFloat(String(stats.abl)) || 0,
    trueRSB: parseFloat(String(stats.rsb)) || 0,
    kMean: parseFloat(String(eyeData.kavg)) || 43.0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      
      

      {/* Таблица данных рефракции */}
      <div style={{
        background: C.surface2, border: `1px solid ${C.border}`,
        borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: F.sans, fontSize: 10, color: C.muted, fontWeight: 700 }}>BCVA</span>
              <span style={{ fontFamily: F.mono, fontSize: 14, color: parseFloat(eyeData.bcva ?? '') < 0.9 ? C.yellow : C.green, fontWeight: 800 }}>{eyeData.bcva || '—'}</span>
            </div>
            {(eyeData.man_sph || eyeData.man_cyl) && (
              <span style={{ fontFamily: F.mono, fontSize: 11, color: ec.color, fontWeight: 700 }}>
                {eyeData.man_sph ? (parseFloat(eyeData.man_sph) >= 0 ? '+' : '') + parseFloat(eyeData.man_sph).toFixed(2) : ''}
                {eyeData.man_cyl && eyeData.man_cyl !== '0' ? ` ${parseFloat(eyeData.man_cyl) >= 0 ? '+' : ''}${parseFloat(eyeData.man_cyl).toFixed(2)}` : ''}
                {eyeData.man_ax ? ` ×${eyeData.man_ax}°` : ''}
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(50px, 1fr) 1fr 1fr 1fr',
            gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 8
          }}>
            {/* Header */}
            <div />
            <div style={{ textAlign: 'center', fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>SPH</div>
            <div style={{ textAlign: 'center', fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>CYL</div>
            <div style={{ textAlign: 'center', fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>AX</div>

            {/* Narrow */}
            <div style={{ fontFamily: F.sans, fontSize: 8, color: C.muted, fontWeight: 600 }}>Узкий</div>
            <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: C.text, fontWeight: 500 }}>{fmt(parseFloat(eyeData.n_sph), 2)}</div>
            <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: C.text, fontWeight: 500 }}>{fmt(parseFloat(eyeData.n_cyl), 2)}</div>
            <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: C.text, fontWeight: 500 }}>{eyeData.n_ax || '—'}°</div>

            {/* Wide */}
            {(() => {
              const nSph = parseFloat(eyeData.n_sph) || 0;
              const cSph = parseFloat(eyeData.c_sph) || 0;
              const isHighlight = Math.abs(nSph - cSph) >= 0.5 && eyeData.c_sph !== undefined && eyeData.c_sph !== '';
              const cText = isHighlight ? C.yellow : C.text;
              const cLabel = isHighlight ? C.yellow : C.muted;
              return (
                <>
                  <div style={{ fontFamily: F.sans, fontSize: 8, color: cLabel, fontWeight: isHighlight ? 800 : 600 }}>Широкий</div>
                  <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: cText, fontWeight: isHighlight ? 700 : 500 }}>{fmt(parseFloat(eyeData.c_sph), 2)}</div>
                  <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: cText, fontWeight: isHighlight ? 700 : 500 }}>{fmt(parseFloat(eyeData.c_cyl), 2)}</div>
                  <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: cText, fontWeight: isHighlight ? 700 : 500 }}>{eyeData.c_ax || '—'}°</div>
                </>
              );
            })()}

            {/* Kerato header */}
            <div style={{ gridColumn: '1/-1', borderTop: `1px solid ${C.border}`, marginTop: 1 }} />
            <div />
            <div style={{ textAlign: 'center', fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>Kmean</div>
            <div style={{ textAlign: 'center', fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>Kcyl</div>
            <div style={{ textAlign: 'center', fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>Kax</div>

            {/* Kerato values */}
            <div style={{ fontFamily: F.sans, fontSize: 8, color: (eyeData.p_tot_c || eyeData.p_ant_c) ? C.accent : C.muted, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span>Керато</span>
              {(eyeData.p_tot_c || eyeData.p_ant_c) && (
                <span style={{ fontSize: 6, color: C.accent, fontWeight: 800, letterSpacing: '.06em' }}>PENTACAM</span>
              )}
            </div>
            <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: C.text, fontWeight: 500 }}>{eyeData.kavg || '—'}</div>
            <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: eyeData.p_tot_c ? C.accent : C.text, fontWeight: eyeData.p_tot_c ? 700 : 500 }}>{
              (() => {
                // Приоритет 1: Pentacam Total (Force MINUS for display)
                if (eyeData.p_tot_c) return fmt(-Math.abs(parseFloat(eyeData.p_tot_c)), 2);
                // Приоритет 1.5: Pentacam Anterior (Force MINUS for display)
                if (eyeData.p_ant_c) return fmt(-Math.abs(parseFloat(eyeData.p_ant_c)), 2);
                // Приоритет 2: Кератометрия K1/K2
                const k1 = parseFloat(eyeData.k1 ?? '');
                const k2 = parseFloat(eyeData.k2 ?? '');
                if (!isNaN(k1) && !isNaN(k2)) return fmt(-Math.abs(k2 - k1), 2);
                // Приоритет 3: Autoref KerCyl
                if (eyeData.kercyl) return fmt(parseFloat(eyeData.kercyl), 2);
                return '—';
              })()
            }</div>
            <div style={{ textAlign: 'center', fontFamily: F.mono, fontSize: 10, color: eyeData.p_tot_a ? C.accent : C.text, fontWeight: eyeData.p_tot_a ? 700 : 500 }}>{
              (() => {
                if (eyeData.p_tot_a) return `${eyeData.p_tot_a}°`;
                return eyeData.kerax ? `${eyeData.kerax}°` : (eyeData.k_ax ? `${eyeData.k_ax}°` : '—');
              })()
            }</div>
          </div>
        </div>
      </div>

      {/* СТРАТЕГИЯ АСТИГМАТИЗМА (интерактивный блок) */}
      <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {([
            { id: 'manifest', label: 'Манифест' },
            { id: 'corneal',  label: 'Роговичный' },
            { id: 'vector',   label: 'Вектор 50/50' },
          ] as const).map(s => {
            const strategy = draft?.astigStrategy ?? (draft?.useCorneal ? 'corneal' : 'manifest');
            return (
              <Chip
                key={s.id}
                label={s.label}
                active={strategy === s.id}
                color={C.accent}
                onClick={() => { setDraft({ astigStrategy: s.id, useCorneal: s.id === 'corneal' }); setPlanTweaked(false); }}
                style={{ width: '100%', justifyContent: 'center', height: 22, fontSize: 8, padding: '0 4px' }}
              />
            );
          })}
        </div>
      </div>

      {/* deltaWarning */}
      {plan.deltaWarning && (
        <div style={{
          background: C.yellowLt, border: `1px solid rgba(251,191,36,.3)`,
          borderRadius: 10, padding: '8px 10px',
          fontFamily: F.sans, fontSize: 11, color: C.yellow,
        }}>
          {plan.deltaWarning}
        </div>
      )}

      {/* План вмешательства */}
      <div style={{
        background: C.surface2, border: `1px solid ${C.border}`,
        borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SectionLabel color={ec.color} style={{ marginBottom: 0 }}>ПЛАН ВМЕШАТЕЛЬСТВА</SectionLabel>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button
                onClick={() => setDraft({ noNomogram: !draft?.noNomogram })}
                style={{
                  padding: '0 10px', height: 18, borderRadius: 10,
                  background: draft?.noNomogram ? `${C.red}15` : 'transparent',
                  border: `1px solid ${draft?.noNomogram ? `${C.red}30` : C.border}`,
                  color: draft?.noNomogram ? C.red : C.muted,
                  fontFamily: F.sans, fontSize: 8, fontWeight: 800,
                  cursor: 'pointer', transition: 'all .2s', letterSpacing: '.02em'
                }}
              >
                БЕЗ НОМО
              </button>
              
              <button
                onClick={() => setDraft({ doRound: !draft?.doRound })}
                style={{
                  padding: '0 8px', height: 18, borderRadius: 10,
                  background: draft?.doRound ? `${C.accent}15` : 'transparent',
                  border: `1px solid ${draft?.doRound ? `${C.accent}30` : C.border}`,
                  color: draft?.doRound ? C.accent : C.muted,
                  fontFamily: F.sans, fontSize: 8, fontWeight: 800,
                  cursor: 'pointer', transition: 'all .2s', letterSpacing: '.02em'
                }}
              >
                ≈ 0.25
              </button>
              
              <button
                onClick={handleReset}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: C.muted2, background: 'transparent',
                  border: 'none', padding: 0, marginLeft: 2
                }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <WheelField
              label="SPH"
              value={String(plan.sph)}
              onChange={v => setPlanField(eye, 'sph', parseFloat(v) || 0)}
              min={-14} max={6} step={0.25}
              accentColor={ec.color}
              accentText={true}
            />
            <WheelField
              label="CYL"
              value={String(plan.cyl)}
              onChange={v => setPlanField(eye, 'cyl', parseFloat(v) || 0)}
              min={-6} max={0} step={0.25}
              accentColor={ec.color}
              accentText={true}
            />
            <DField
              label="AX"
              value={String(plan.ax)}
              onChange={v => setPlanField(eye, 'ax', parseFloat(v) || 0)}
              type="number"
              accentColor={ec.color}
              textColor={C.text}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <WheelField
              label="OZ"
              value={draft?.oz ?? '6.5'}
              onChange={v => setDraft({ oz: v })}
              min={5.0} max={8.0} step={0.1}
              accentColor={ec.color}
              textColor={C.text}
              unit="мм"
            />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{
              fontFamily: F.sans, fontSize: 8, fontWeight: 800, color: C.muted,
              letterSpacing: '.07em', textTransform: 'uppercase', paddingLeft: 2
            }}>
              FLAP (мкм)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {['90', '100', '110'].map(val => (
                <button
                  key={val}
                  onClick={() => setDraft({ capOrFlap: val })}
                  style={{
                    height: 28, borderRadius: 14,
                    background: (draft?.capOrFlap === val) ? `${C.accent}20` : C.surface3,
                    border: `1px solid ${(draft?.capOrFlap === val) ? C.accent : C.border}`,
                    color: (draft?.capOrFlap === val) ? C.accent : C.text,
                    fontFamily: F.mono, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', transition: 'all .15s'
                  }}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
          </div>

          {/* Индикаторы */}
          <div style={{
            background: C.surface3, border: `1px solid ${C.border}`,
            borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
                <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { label: 'ABL', value: stats.abl, unit: 'мкм', level: ablLevel(stats.abl) },
                { label: 'RSB', value: stats.rsb, unit: 'мкм', level: rsbLevel(stats.rsb) },
                { label: 'PTA / TOT', value: stats.pta, unit: '%', level: ptaLevel(stats.pta) },
                { label: 'KPOST', value: stats.kpost, unit: 'D', level: kpostLevel(stats.kpost) },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: C.muted, letterSpacing: '.05em' }}>{s.label}</div>
                  <div style={{
                    fontFamily: F.mono, fontSize: 13, fontWeight: 800,
                    color: s.level === 'red' ? C.red : s.level === 'yellow' ? C.yellow : C.green
                  }}>
                    {s.value} <span style={{ fontSize: 8, fontWeight: 400, color: C.muted }}>{s.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>


        </div>
      </div>

      {/* Астигматизм: источник, тип, цель */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0' }}>
        {plan.astigSrc && plan.astigSrc !== 'Нет данных' && (
          <span style={{
            fontFamily: F.sans, fontSize: 10, color: C.muted2,
            background: C.surface3, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            {plan.astigSrc}
          </span>
        )}
        {plan.astigType && (
          <span style={{
            fontFamily: F.sans, fontSize: 10, fontWeight: 700,
            color: plan.astigType === 'ATR' ? C.yellow : plan.astigType === 'WTR' ? C.green : C.muted2,
            background: C.surface3, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            {plan.astigType}
          </span>
        )}

        {plan.ora !== null && parseFloat(plan.ora ?? '') >= 0.75 && (
          <span style={{
            fontFamily: F.sans, fontSize: 10, color: C.yellow,
            background: C.yellowLt, border: `1px solid rgba(251,191,36,.3)`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            ORA {plan.ora} D
          </span>
        )}
      </div>


      {/* Интерактивный Профиль Абляции */}
      <AblationViz data={vizData} />

    </div>
  );
}

// ── PlanTab ───────────────────────────────────────────────────────────────────

// ── Катарактальный план ───────────────────────────────────────────────────────

function CataractPlanTab() {
  const { draft, setDraft, iolResult } = useSessionStore();
  const { planEye } = useUIStore();
  if (!draft) return null;

  const ec = eyeColors(planEye);
  const r = iolResult?.[planEye];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px' }}>

      {/* Линза */}
      <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel color={ec.color}>ЛИНЗА</SectionLabel>
          {iolResult ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: C.text }}>{iolResult.lens}</span>
                <span style={{ fontFamily: F.sans, fontSize: 10, color: C.muted, fontWeight: 600 }}>{r?.formula || 'Формула не выбрана'}</span>
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 13, color: ec.color }}>A={iolResult.aConst}</span>
            </div>
          ) : (
            <span style={{ fontFamily: F.sans, fontSize: 12, color: C.muted }}>Перейдите в «Расчёт ИОЛ» для выбора линзы</span>
          )}
        </div>
      </div>

      {/* Рекомендованная мощность */}
      {r && (
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel color={ec.color}>МОЩНОСТЬ ИОЛ {planEye.toUpperCase()}</SectionLabel>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: ec.bg, border: `1px solid ${ec.border}`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 800, color: ec.color }}>
                  {r.p_emmetropia > 0 ? '+' : ''}{r.p_emmetropia.toFixed(1)} D
                </span>
                {r.toricPower != null && (
                  <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: C.yellow }}>
                    TORIC T{r.toricPower.toFixed(2)} @ {r.toricAx}°
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontFamily: F.sans, fontSize: 8, color: C.muted, fontWeight: 800, textTransform: 'uppercase' }}>Остаточная рефракция</span>
                <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.green }}>
                  {r.expectedRefr != null ? (r.expectedRefr > 0 ? '+' : '') + r.expectedRefr.toFixed(2) : '0.00'} D
                </div>
                {r.toricResidual && (
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: C.green, fontWeight: 600 }}>
                    {r.toricResidual}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Целевая рефракция */}
      <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel color={ec.color}>ПАРАМЕТРЫ ОПЕРАЦИИ</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <WheelField
              label="Целевая рефракция D"
              value={draft.targetRefr ?? '0'}
              onChange={v => setDraft({ targetRefr: v })}
              min={-4} max={2} step={0.25} accentColor={ec.color}
            />
            <DField
              label="SIA D"
              value={draft.sia ?? '0.1'}
              onChange={v => setDraft({ sia: v })}
              type="number" step=".05"
              accentColor={ec.color}
            />
            <DField
              label="Ось SIA °"
              value={draft.siaAx ?? '0'}
              onChange={v => setDraft({ siaAx: v })}
              type="number"
              accentColor={ec.color}
            />
            <DField
              label="Дата операции"
              value={draft.date ?? ''}
              onChange={v => setDraft({ date: v })}
              type="text" placeholder="YYYY-MM-DD"
              accentColor={ec.color}
            />
          </div>
        </div>
      </div>

      {/* Торическая схема */}
      {iolResult && (iolResult.od?.toricAx != null || iolResult.os?.toricAx != null) && (
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionLabel color={ec.color}>ОРИЕНТАЦИЯ ТОРИЧЕСКОЙ ИОЛ</SectionLabel>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              {(['od', 'os'] as const).filter(ek => ek === planEye).map(ek => {
                const r = iolResult[ek];
                if (!r?.toricAx) return null;
                return (
                  <div key={ek} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <ToricSchematic
                      eye={ek}
                      toricAx={r.toricAx}
                      incisionAx={parseFloat(draft.siaAx ?? '') || 90}
                      size={180}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 900, color: C.yellow }}>{r.toricAx}°</span>
                      {r.toricPower != null && (
                        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.muted, fontWeight: 600 }}>T{r.toricPower.toFixed(2)} D</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Примечание */}
      <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px' }}>
          <SectionLabel color={ec.color}>ПРИМЕЧАНИЕ</SectionLabel>
          <DField
            label="Заметка хирурга"
            value={draft.note ?? ''}
            onChange={v => setDraft({ note: v })}
            type="text" placeholder="Особенности, риски..."
          />
        </div>
      </div>

    </div>
  );
}

// ── PlanTab ───────────────────────────────────────────────────────────────────

export function PlanTab() {
  const { draft, setDraft, setRefPlan, planTweaked, setPlanTweaked } = useSessionStore();
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCalendar && calendarRef.current) {
      setTimeout(() => {
        calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [showCalendar]);
  const { planEye, setPlanEye } = useUIStore();

  const { activeLaser } = useClinicStore();
  const laser = activeLaser || 'ex500';
  const strategy = draft?.astigStrategy ?? (draft?.useCorneal ? 'corneal' : 'manifest');

  // Пересчитываем план при изменении любых входных данных, если хирург не вносил ручную правку
  useEffect(() => {
    if (!planTweaked && draft) {
      const age = parseFloat(draft.age ?? '0') || 0;
      setRefPlan({
        od: computeRefPlan(draft.od ?? newEyeData(), laser as any, false, !!draft.doRound, age, !!draft.noNomogram, strategy) ?? undefined,
        os: computeRefPlan(draft.os ?? newEyeData(), laser as any, false, !!draft.doRound, age, !!draft.noNomogram, strategy) ?? undefined,
      });
    }
  }, [
    planTweaked, draft,
    laser, strategy
  ]);

  if (!draft) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px' }}>

      {/* Переключатель глаз (всегда сверху) */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle value={planEye} onChange={setPlanEye} />
      </div>


      {draft.type === 'cataract' ? (
        <CataractPlanTab />
      ) : (
        <>
          <PlanResult eye={planEye} laser={laser} onReset={() => {
            const age = parseFloat(draft.age ?? '0') || 0;
            setPlanTweaked(false);
            setRefPlan({
              od: computeRefPlan(draft.od ?? newEyeData(), laser as any, false, !!draft.doRound, age, !!draft.noNomogram, strategy) ?? undefined,
              os: computeRefPlan(draft.os ?? newEyeData(), laser as any, false, !!draft.doRound, age, !!draft.noNomogram, strategy) ?? undefined,
            });
          }} />

        </>
      )}

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
            : 'ЗАПИСАТЬ НА ОПЕРАЦИЮ'}
        </button>

        {showCalendar && (
          <div ref={calendarRef} style={{ animation: 'fadeIn .2s ease' }}>
            <Calendar 
              selectedDate={draft.date || null} 
              onSelect={(isoDate) => { 
                setDraft({ date: isoDate, status: 'planned', isEnhancement: false }); 
                setTimeout(() => setShowCalendar(false), 200); 
              }} 
            />
          </div>
        )}
      </div>

    </div>
  );
}
