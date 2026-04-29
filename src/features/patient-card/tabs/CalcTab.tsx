import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { useTelegram } from '../../../hooks/useTelegram';
import { C, F, eyeColors } from '../../../constants/design';
import { EyeToggle } from '../../../ui';
import { useRef } from 'react';
import { T } from '../../../constants/translations';

export function CalcTab() {
  const {
    draft, iolResult, formulaResults,
    iolError: calcError, iolLoading: isCalculating, toricResults,
    toggleSurgicalEye, setBioField, setEyeField
  } = useSessionStore();
  const {
    activeEye, setActiveEye,
    editingField, setEditingField, tempValue, setTempValue
  } = useUIStore();
  const { language } = useClinicStore();
  const t = T(language);
  const { haptic } = useTelegram();
  const inputRef = useRef<HTMLInputElement>(null);

  if (!draft) return null;

  const bio     = (draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] as any) || {};
  const eyeData = (draft[activeEye] as any) || {};
  const ec      = eyeColors(activeEye);

  const activeFormula  = draft.activeFormula || 'Barrett';
  const eyeResults     = formulaResults[activeEye] || {};
  const results        = eyeResults[activeFormula] || eyeResults[activeFormula.toLowerCase()] || [];

  const selectedPowerNum = (iolResult as any)?.[activeEye]?.selectedPower || 0;
  const targetVal        = parseFloat((draft as any).targetRefr || '0');

  const bestByTarget = results.length > 0
    ? results.reduce((prev: any, curr: any) =>
        Math.abs((curr.refraction ?? curr.ref ?? 0) - targetVal) <
        Math.abs((prev.refraction ?? prev.ref ?? 0) - targetVal) ? curr : prev)
    : null;

  const selectedResult = results.find((r: any) => Math.abs(r.power - selectedPowerNum) < 0.01)
    || (selectedPowerNum === 0 ? bestByTarget : null);

  const displayPower = selectedResult?.power;
  const predSE       = selectedResult ? (selectedResult.refraction ?? selectedResult.ref ?? 0) : null;

  const disabledEyes: ('od' | 'os')[] = [];
  if (draft.eye === 'OD') disabledEyes.push('os');
  if (draft.eye === 'OS') disabledEyes.push('od');

  const handleLongPressEye = (eye: 'od' | 'os') => {
    haptic.impact('heavy');
    toggleSurgicalEye(eye);
  };

  // Inline editable chip
  const EditChip = ({ field, label, val, unit, isBio }: {
    field: string; label: string; val: any; unit: string; isBio?: boolean;
  }) => {
    const isEd = editingField === field;
    const displayVal = (() => {
      const n = parseFloat(String(val));
      if (isNaN(n)) return '—';
      return n > 25 ? n.toFixed(2) : n.toFixed(2);
    })();
    return (
      <div
        onClick={() => { setTempValue(String(val || '')); setEditingField(field); }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: isEd ? `${ec.color}12` : C.surface,
          borderRadius: 10, padding: '4px 8px', border: `1px solid ${isEd ? ec.color : C.border}50`,
          cursor: 'text', minWidth: 44,
        }}
      >
        <span style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        {isEd ? (
          <input
            ref={inputRef}
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            onBlur={() => {
              if (isBio) setBioField(activeEye, field.replace('bio_', ''), tempValue);
              else setEyeField(activeEye, field, tempValue);
              setEditingField(null);
            }}
            onKeyDown={e => e.key === 'Enter' && (inputRef.current as any)?.blur()}
            style={{ width: 40, background: 'none', border: 'none', textAlign: 'center', fontSize: 11, fontWeight: 800, color: ec.color, fontFamily: F.mono, outline: 'none', padding: 0 }}
            autoFocus
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 800, color: C.text, fontFamily: F.mono }}>
            {displayVal}<span style={{ fontSize: 7, color: C.muted3, marginLeft: 1 }}>{unit}</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Eye toggle */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle value={activeEye} onChange={setActiveEye} disabledEyes={disabledEyes} onLongPress={handleLongPressEye} />
      </div>

      {calcError && (
        <div style={{ padding: '8px 12px', background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 12, color: C.red, fontSize: 9, fontWeight: 900, textAlign: 'center' }}>
          {calcError.toUpperCase()}
        </div>
      )}

      {/* ── COMPACT HEADER CARD ─────────────────────────────────────────────── */}
      <div style={{
        background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ec.color, opacity: 0.7 }} />

        <div style={{ padding: '12px 14px 10px' }}>

          {/* Formula selector — slim */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {['Haigis', 'Barrett', 'Kane'].map(f => {
              const isSel = activeFormula.toLowerCase() === f.toLowerCase();
              return (
                <button key={f}
                  onClick={() => { haptic.selection(); useSessionStore.getState().setDraft({ activeFormula: f as 'Haigis' | 'Barrett' | 'Kane' }); }}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 10,
                    border: `1px solid ${isSel ? ec.color : C.border}`,
                    background: isSel ? `${ec.color}15` : C.surface,
                    color: isSel ? ec.color : C.muted2,
                    fontSize: 10, fontWeight: 900, cursor: 'pointer', transition: 'all 0.18s',
                  }}>{f}</button>
              );
            })}
            {isCalculating && (
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: ec.color, animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}
          </div>

          {/* IOL power + Lens + Pred/Target — all in one row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* IOL Power — big number */}
            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 70 }}>
              <div style={{ fontSize: 7, fontWeight: 900, color: ec.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>
                {draft.toricMode ? 'TORIC' : t.iolPower.toUpperCase()}
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: C.text, fontFamily: F.mono, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {displayPower != null ? displayPower.toFixed(2) : '—'}
              </div>
              {draft.toricMode && toricResults?.[activeEye] && (
                <div style={{ fontSize: 9, fontWeight: 900, color: C.indigo, marginTop: 2 }}>
                  {toricResults[activeEye].best_model} · {toricResults[activeEye].total_steep_axis}°
                </div>
              )}
            </div>

            {/* Vertical divider */}
            <div style={{ width: 1, height: 44, background: C.border, opacity: 0.6, flexShrink: 0 }} />

            {/* Right side: lens name + pred SE + target */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Lens name */}
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(iolResult as any)?.lens || <span style={{ color: C.muted3, fontStyle: 'italic' }}>{t.noLensSelected}</span>}
              </div>
              {/* Pred SE + Target */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.green, textTransform: 'uppercase' }}>SE</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                    {predSE != null ? (predSE > 0 ? '+' : '') + predSE.toFixed(2) : '—'}
                  </span>
                </div>
                <div style={{ width: 1, height: 12, background: C.border }} />
                <div style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.amber, textTransform: 'uppercase' }}>{t.target}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                    {(targetVal > 0 ? '+' : '') + targetVal.toFixed(2)}
                  </span>
                </div>
                {results.length > 0 && (
                  <>
                    <div style={{ width: 1, height: 12, background: C.border }} />
                    <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3 }}>{results.length} {t.variants}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Biometry strip — compact chips */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            <EditChip field="bio_al"  label="AL"   val={bio.al}     unit="mm" isBio />
            <EditChip field="bio_acd" label="ACD"  val={bio.acd}    unit="mm" isBio />
            <EditChip field="bio_lt"  label="LT"   val={bio.lt}     unit="mm" isBio />
            <EditChip field="k1"      label="K1"   val={eyeData.k1} unit="D"  />
            <EditChip field="k2"      label="K2"   val={eyeData.k2} unit="D"  />
            <EditChip field="k_ax"    label="Ax"   val={eyeData.k_ax ? `${Math.round(parseFloat(eyeData.k_ax || '0'))}` : '—'} unit="°" />
          </div>
        </div>
      </div>

      {/* ── PREDICTION TABLE ────────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 0.9fr', padding: '9px 16px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 8, fontWeight: 900, color: C.muted3 }}>IOL D</div>
          <div style={{ fontSize: 8, fontWeight: 900, color: C.muted3, textAlign: 'center' }}>{t.predictedRefr.toUpperCase()}</div>
          <div style={{ fontSize: 8, fontWeight: 900, color: C.muted3, textAlign: 'right' }}>Δ {t.target.toUpperCase()}</div>
        </div>

        {results.length > 0 ? (
          <div style={{ overflowY: 'auto', scrollbarWidth: 'none', maxHeight: 320 }}>
            {results.map((r: any, i: number) => {
              const rRef      = r.refraction ?? r.ref ?? 0;
              const isSug     = !selectedPowerNum && bestByTarget?.power === r.power;
              const isSel     = Math.abs(r.power - selectedPowerNum) < 0.01 || isSug;
              const diff      = rRef - targetVal;
              const diffColor = Math.abs(diff) < 0.25 ? C.green : Math.abs(diff) < 0.5 ? C.amber : C.muted3;

              // Toric residual display
              const toricBest = draft.toricMode && toricResults?.[activeEye]
                ? toricResults[activeEye].table.find((s: any) => s.model === toricResults[activeEye].best_model)
                : null;
              const predDisplay = toricBest
                ? `${(rRef + toricBest.residual / 2 > 0 ? '+' : '') + (rRef + toricBest.residual / 2).toFixed(2)} -${(Math.round(toricBest.residual * 20) / 20).toFixed(2)}`
                : (rRef > 0 ? '+' : '') + rRef.toFixed(2);

              return (
                <div
                  key={i}
                  onClick={() => {
                    haptic.selection();
                    const eyeRes = (iolResult as any)?.[activeEye] || {};
                    useSessionStore.getState().setIOLResult({
                      ...(iolResult || {}),
                      [activeEye]: { ...eyeRes, selectedPower: r.power, expectedRefr: rRef },
                    } as any);
                  }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1.3fr 0.9fr',
                    padding: '12px 16px', alignItems: 'center', cursor: 'pointer',
                    borderBottom: i === results.length - 1 ? 'none' : `1px solid ${C.border}30`,
                    background: isSel ? `${ec.color}12` : 'transparent',
                    borderLeft: isSug && !selectedPowerNum ? `3px solid ${ec.color}` : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900, color: isSel ? ec.color : C.text, fontFamily: F.mono }}>
                    {r.power.toFixed(2)}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: isSel ? C.text : C.muted2, fontFamily: F.mono }}>
                    {predDisplay}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: diffColor, fontFamily: F.mono }}>
                    {(diff > 0 ? '+' : '') + diff.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.muted3, letterSpacing: '0.04em', marginBottom: 6 }}>
              {t.noData.toUpperCase()}
            </div>
            <div style={{ fontSize: 10, color: C.muted3, opacity: 0.6 }}>{t.selectFormulaToCalc}</div>
          </div>
        )}
      </div>

      {/* ── TORIC SECTION (compact) ─────────────────────────────────────────── */}
      {draft.toricMode && toricResults?.[activeEye] && (() => {
        const tr   = toricResults[activeEye];
        const best = tr.table.find((s: any) => s.model === tr.best_model);
        return (
          <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.indigo}30`, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '10px 14px 8px', background: `${C.indigo}08`, borderBottom: `1px solid ${C.indigo}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t.toricRecommendation.toUpperCase()}
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>Model</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.indigo, fontFamily: F.mono }}>{tr.best_model}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>Axis</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: F.mono }}>{tr.total_steep_axis}°</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>IOL Cyl</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: F.mono }}>{best?.cyl_iol.toFixed(2)}D</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>Residual</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.green, fontFamily: F.mono }}>-{(Math.round((best?.residual || 0) * 20) / 20).toFixed(2)}D</div>
                </div>
              </div>
            </div>

            {/* Toric table — compact rows */}
            {tr.table.filter((s: any) => s.model !== 'None').map((row: any, idx: number) => {
              const isSel      = row.model === tr.best_model;
              const resColor   = row.residual < 0.5 ? C.green : row.residual < 0.75 ? C.amber : C.muted3;
              return (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  padding: '9px 14px', alignItems: 'center',
                  background: isSel ? `${C.indigo}10` : 'transparent',
                  borderBottom: idx === tr.table.length - 2 ? 'none' : `1px solid ${C.border}25`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: isSel ? C.indigo : C.text, fontFamily: F.mono }}>{row.model}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted2, fontFamily: F.mono, textAlign: 'center' }}>{row.cyl_iol.toFixed(2)}D</div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: resColor, fontFamily: F.mono, textAlign: 'center' }}>-{(Math.round(row.residual * 20) / 20).toFixed(2)}D</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.muted2, fontFamily: F.mono, textAlign: 'right' }}>
                    {row.res_axis ? `${row.res_axis}°` : '—'}{row.is_wtr ? <span style={{ color: C.green, marginLeft: 3 }}>▲</span> : ''}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
