import { useRef } from 'react';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { useTelegram } from '../../../hooks/useTelegram';
import { EyeToggle, AutoRepeatButton } from '../../../ui';
import { T } from '../../../constants/translations';
import { C, F, eyeColors } from '../../../constants/design';
import { MedDisclaimer } from '../../disclaimer/MedDisclaimer';

export function CalcTab() {
  const {
    draft, iolResult, formulaResults,
    iolError: calcError, iolLoading: isCalculating, toricResults,
    toggleSurgicalEye, setBioField, setEyeField, setIOLResult
  } = useSessionStore();
  const {
    activeEye, setActiveEye,
    editingField, setEditingField, tempValue, setTempValue,
    comparisonFormulas, toggleComparisonFormula
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
  
  // Formulas to show: active formula + any in comparisonFormulas that have results
  const formulasToShow = [
    activeFormula,
    ...comparisonFormulas.filter(f => f !== activeFormula && eyeResults[f]?.length > 0)
  ];

  const mainResults = eyeResults[activeFormula] || eyeResults[activeFormula.toLowerCase()] || [];

  const selectedPowerNum = (iolResult as any)?.[activeEye]?.selectedPower || 0;
  const targetVal        = parseFloat((draft as any).targetRefr || '0');

  const bestByTarget = mainResults.length > 0
    ? mainResults.reduce((prev: any, curr: any) =>
        Math.abs((curr.refraction ?? curr.ref ?? 0) - targetVal) <
        Math.abs((prev.refraction ?? prev.ref ?? 0) - targetVal) ? curr : prev)
    : null;

  const selectedResult = mainResults.find((r: any) => Math.abs(r.power - selectedPowerNum) < 0.01)
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
  const EditChip = ({ field, label, val, unit, isBio, readOnly }: {
    field: string; label: string; val: any; unit: string; isBio?: boolean; readOnly?: boolean;
  }) => {
    const isEd = editingField === field && !readOnly;
    const step = field.includes('al') || field.includes('acd') || field.includes('lt') ? 0.01 : 0.25;

    const onStep = (dir: number) => {
      if (readOnly) return;
      const cur = parseFloat(String(val || '0'));
      const nv = (cur + dir * step).toFixed(2);
      if (isBio) setBioField(activeEye, field.replace('bio_', ''), nv);
      else setEyeField(activeEye, field, nv);
      haptic.light();
    };

    const displayVal = (() => {
      const n = parseFloat(String(val));
      if (isNaN(n)) return '—';
      return n.toFixed(2);
    })();

    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: isEd ? `${ec.color}12` : C.surface,
          borderRadius: 14, padding: '4px 2px 6px', border: `1px solid ${isEd ? ec.color : C.border}60`,
          flex: 1, minWidth: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 2px 2px', borderBottom: `1px solid ${C.border}30`, marginBottom: 4 }}>
          {!readOnly ? (
            <>
              <AutoRepeatButton onTrigger={() => onStep(-1)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '8px 12px', margin: '-8px -8px', cursor: 'pointer' }}>−</AutoRepeatButton>
              <span style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              <AutoRepeatButton onTrigger={() => onStep(1)} style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 18, padding: '8px 12px', margin: '-8px -8px', cursor: 'pointer' }}>+</AutoRepeatButton>
            </>
          ) : (
            <div style={{ width: '100%', textAlign: 'center', fontSize: 6.5, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
          )}
        </div>
        
        <div onClick={() => { if (!readOnly) { setTempValue(String(val || '')); setEditingField(field); } }} style={{ cursor: readOnly ? 'default' : 'text', width: '100%', textAlign: 'center' }}>
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
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', fontSize: 12, fontWeight: 900, color: ec.color, fontFamily: F.mono, outline: 'none', padding: 0 }}
              autoFocus
            />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
              {displayVal}<span style={{ fontSize: 7, color: C.muted3, marginLeft: 1 }}>{unit}</span>
            </span>
          )}
        </div>
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
              const hasRes = (eyeResults[f] || eyeResults[f.toLowerCase()])?.length > 0;
              const isMain = activeFormula === f;
              const inComp = comparisonFormulas.includes(f) && !isMain;
              const isSel = isMain || inComp;

              return (
                <button key={f}
                  onClick={() => {
                    haptic.selection();
                    if (isMain && hasRes) {
                      // If already main, do nothing or maybe allow toggling off if others exist?
                      // For now, keep as is.
                    } else if (hasRes) {
                      // If has results and not main, toggle comparison or set as main
                      if (inComp) {
                        toggleComparisonFormula(f);
                      } else {
                        // If not in comparison, clicking it makes it MAIN (swaps)
                        // but he wanted "adding".
                        // So if we click a formula that has results, we can either make it main or add to comp.
                        // Let's make it so clicking a calculated formula ADDS it to comp if not main.
                        toggleComparisonFormula(f);
                      }
                    } else {
                      // If no results, set as main to trigger calc
                      useSessionStore.getState().setDraft({ activeFormula: f as any });
                    }
                  }}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 10,
                    border: `1px solid ${isSel ? (isMain ? ec.color : C.indigo) : C.border}`,
                    background: isSel ? (isMain ? `${ec.color}15` : `${C.indigo}10`) : C.surface,
                    color: isSel ? (isMain ? ec.color : C.indigo) : C.muted2,
                    fontSize: 10, fontWeight: 900, cursor: 'pointer', transition: 'all 0.18s',
                    position: 'relative'
                  }}>
                  {f}
                  {hasRes && !isMain && !inComp && (
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: C.indigo }} />
                  )}
                </button>
              );
            })}
            {isCalculating && (
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: ec.color, animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}
          </div>

          {/* IOL power + Lens + Pred/Target — Centered */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '10px 0 14px' }}>
            {/* IOL Power — big number */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: ec.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
                {t.iolPower.toUpperCase()}
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, color: C.text, fontFamily: F.mono, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {displayPower != null ? displayPower.toFixed(2) : '—'}
              </div>
              {draft.toricMode && toricResults?.[activeEye] && (() => {
                const tr = toricResults[activeEye];
                const eyeRes = (iolResult as any)?.[activeEye] || {};
                const selectedModel = eyeRes.selectedToricModel || tr.best_model;
                const match = tr.table.find((s: any) => s.model === selectedModel);
                if (!match || match.model === 'None') return null;
                return (
                  <div style={{ fontSize: 11, fontWeight: 900, color: C.indigo, marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ background: `${C.indigo}15`, padding: '4px 8px', borderRadius: 8, fontFamily: F.mono }}>{match.model}</span>
                      <span style={{ background: `${C.indigo}15`, padding: '4px 8px', borderRadius: 8, fontFamily: F.mono }}>{(match.cyl_iol > 0 ? '+' : '') + match.cyl_iol.toFixed(2)}D</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ background: `${C.green}15`, color: C.green, padding: '4px 8px', borderRadius: 8, fontFamily: F.mono }}>Res: -{(Math.round((match.residual || 0) * 20) / 20).toFixed(2)}D</span>
                      <span style={{ background: `${C.surface}`, border: `1px solid ${C.border}`, padding: '4px 8px', borderRadius: 8, fontFamily: F.mono, color: C.text }}>{tr.total_steep_axis}°</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Lens name */}
            <div style={{ fontSize: 12, fontWeight: 800, color: C.secondary, maxWidth: '90%', textAlign: 'center' }}>
              {(iolResult as any)?.lens || <span style={{ color: C.muted3, fontStyle: 'italic' }}>{t.noLensSelected}</span>}
            </div>

            {/* Pred SE + Target */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: C.surface, padding: '8px 16px', borderRadius: 14, border: `1px solid ${C.border}40` }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pred SE</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                  {predSE != null ? (predSE > 0 ? '+' : '') + predSE.toFixed(2) : '—'}
                </span>
              </div>
              <div style={{ width: 1, height: 16, background: C.border }} />
              <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.target}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                  {(targetVal > 0 ? '+' : '') + targetVal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Biometry strip — compact chips spread across width */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingBottom: 2 }}>
            <EditChip field="bio_al"  label="AL"   val={bio.al}     unit="mm" isBio readOnly />
            <EditChip field="bio_acd" label="ACD"  val={bio.acd}    unit="mm" isBio readOnly />
            <EditChip field="bio_lt"  label="LT"   val={bio.lt}     unit="mm" isBio readOnly />
          </div>
        </div>
      </div>

      {/* ── PREDICTION TABLES SIDE-BY-SIDE ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {formulasToShow.map(fName => {
          const fResults = eyeResults[fName] || eyeResults[fName.toLowerCase()] || [];
          const isMain = fName === activeFormula;
          const fColor = isMain ? ec.color : C.indigo;

          return (
            <div key={fName} style={{ 
              flex: formulasToShow.length === 2 ? '0 0 49%' : (formulasToShow.length > 2 ? '0 0 85%' : '1 1 100%'), 
              background: C.card, borderRadius: 20, border: `1px solid ${isMain ? C.border : fColor + '30'}`, overflow: 'hidden' 
            }}>
              {/* Table header */}
              <div style={{ 
                display: 'grid', gridTemplateColumns: '1fr 1fr', 
                padding: '9px 12px', alignItems: 'center', 
                background: isMain ? C.surface : fColor + '08', 
                borderBottom: `1px solid ${C.border}` 
              }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: fColor }}>{fName.toUpperCase()}</span>
                <span style={{ textAlign: 'right', fontSize: 7, fontWeight: 900, color: C.muted3, letterSpacing: '0.04em' }}>DEV.</span>
              </div>

              {fResults.length > 0 ? (
                <div style={{ overflowY: 'auto', scrollbarWidth: 'none', maxHeight: 320 }}>
                  {fResults.map((r: any, i: number) => {
                    const rRef      = r.refraction ?? r.ref ?? 0;
                    const isSug     = isMain && !selectedPowerNum && bestByTarget?.power === r.power;
                    const isSel     = isMain && (Math.abs(r.power - selectedPowerNum) < 0.01 || isSug);
                    const diff      = rRef - targetVal;
                    const diffColor = Math.abs(diff) < 0.25 ? C.green : Math.abs(diff) < 0.5 ? C.amber : C.muted3;

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (isMain) {
                            haptic.selection();
                            const eyeRes = (iolResult as any)?.[activeEye] || {};
                            
                            // Find matching toric model for this power
                            const toricMatch = draft.toricMode && toricResults?.[activeEye]
                              ? toricResults[activeEye].table.find((s: any) => Math.abs(s.power - r.power) < 0.01)
                              : null;

                            setIOLResult({
                              ...(iolResult || {}),
                              [activeEye]: { 
                                ...eyeRes, 
                                selectedPower: r.power, 
                                expectedRefr: rRef,
                                selectedToricModel: toricMatch?.model ?? eyeRes.selectedToricModel
                              },
                            } as any);
                          } else {
                            haptic.selection();
                            useSessionStore.getState().setDraft({ activeFormula: fName as any });
                          }
                        }}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr',
                          padding: '12px 12px', alignItems: 'center', cursor: 'pointer',
                          borderBottom: i === fResults.length - 1 ? 'none' : `1px solid ${C.border}30`,
                          background: isSel ? `${fColor}12` : 'transparent',
                          borderLeft: isSug && isMain && !selectedPowerNum ? `3px solid ${fColor}` : '3px solid transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 16, fontWeight: 900, color: isSel ? fColor : C.text, fontFamily: F.mono }}>
                          {r.power.toFixed(2)}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: diffColor, fontFamily: F.mono }}>
                          {(diff > 0 ? '+' : '') + diff.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: C.muted3 }}>{t.noData}</div>
                </div>
              )}
            </div>
          );
        })}

        {formulasToShow.length === 0 && (
          <div style={{ flex: 1, padding: '36px 24px', textAlign: 'center', background: C.card, borderRadius: 20, border: `1px dashed ${C.border}` }}>
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
        const eyeRes = (iolResult as any)?.[activeEye] || {};
        const selectedModel = eyeRes.selectedToricModel ?? tr.best_model;
        const best = tr.table.find((s: any) => s.model === selectedModel) || tr.table.find((s: any) => s.model === tr.best_model);
        
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
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.indigo, fontFamily: F.mono }}>{best?.model}</div>
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
              const currentSelectedModel = (iolResult as any)?.[activeEye]?.selectedToricModel ?? tr.best_model;
              const isSel      = row.model === currentSelectedModel;
              const resColor   = row.residual < 0.5 ? C.green : row.residual < 0.75 ? C.amber : C.muted3;
              return (
                <div 
                  key={idx} 
                  onClick={() => {
                    haptic.selection();
                    const eyeRes = (iolResult as any)?.[activeEye] || {};
                    setIOLResult({
                      ...(iolResult || {}),
                      [activeEye]: { 
                        ...eyeRes, 
                        selectedToricModel: row.model,
                        selectedPower: eyeRes.selectedPower ?? displayPower,
                        expectedRefr: eyeRes.expectedRefr ?? predSE,
                        toricCyl: row.cyl_iol,
                        toricAxis: row.res_axis ?? tr.total_steep_axis
                      },
                    } as any);
                  }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    padding: '9px 14px', alignItems: 'center', cursor: 'pointer',
                    background: isSel ? `${C.indigo}10` : 'transparent',
                    borderLeft: isSel ? `3px solid ${C.indigo}` : '3px solid transparent',
                    borderBottom: idx === tr.table.length - 2 ? 'none' : `1px solid ${C.border}25`,
                    transition: 'all 0.15s',
                  }}
                >
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

      <MedDisclaimer />
    </div>
  );
}
