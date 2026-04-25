import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useTelegram } from '../../../hooks/useTelegram';
import { C, F, eyeColors } from '../../../constants/design';
import { SectionLabel, AxisDial, EyeToggle } from '../../../ui';
import { calculateToricJS } from '../../../calculators/astigmatism';
import { useEffect, useRef } from 'react';

export function CalcTab() {
  const {
    draft, iolResult, formulaResults,
    iolError: calcError, iolLoading: isCalculating, toricResults, setToricResults,
    toggleSurgicalEye
  } = useSessionStore();
  const { 
    activeEye, setActiveEye, 
    editingField, setEditingField, tempValue, setTempValue 
  } = useUIStore();
  const { haptic } = useTelegram();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  useEffect(() => {
    if (draft?.toricMode) {
      const bio = (draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] as any) || {};
      const eyeData = (draft[activeEye] as any) || {};
      
      const k1 = parseFloat(eyeData.k1 || '0');
      const k2 = parseFloat(eyeData.k2 || '0');
      if (k1 > 0 && k2 > 0) {
        const res = calculateToricJS(
          k1, k2, parseFloat(eyeData.k_ax || '0'),
          parseFloat(draft.sia || '0.1'),
          parseFloat((draft as any).incAx || '90'),
          parseFloat(bio.al || '23.5')
        );
        setToricResults({ ...toricResults, [activeEye]: res });
      }
    }
  }, [draft?.toricMode, draft?.sia, (draft as any)?.incAx, activeEye, draft?.od?.k1, draft?.os?.k1, draft?.od?.k2, draft?.os?.k2]);

  if (!draft) return null;

  const handleStartEdit = (field: string, val: any) => {
    setTempValue(String(val || ''));
    setEditingField(field);
  };

  const handleFinishEdit = () => {
    if (editingField) {
      if (editingField.startsWith('bio_')) {
        setBioField(activeEye, editingField.replace('bio_', ''), tempValue);
      } else {
        setEyeField(activeEye, editingField, tempValue);
      }
    }
    setEditingField(null);
  };

  const disabledEyes: ('od' | 'os')[] = [];
  if (draft.eye === 'OD') disabledEyes.push('os');
  if (draft.eye === 'OS') disabledEyes.push('od');

  const bio = (draft[`bio_${activeEye}` as 'bio_od' | 'bio_os'] as any) || {};
  const eyeData = (draft[activeEye] as any) || {};
  const ec = eyeColors(activeEye);

  const BioField = ({ label, field, val, unit }: { label: string, field: string, val: any, unit: string }) => {
    const isEditing = editingField === field;
    return (
      <div 
        onClick={() => handleStartEdit(field, val)}
        style={{ background: C.surface, borderRadius: 12, padding: '8px 10px', border: `1px solid ${isEditing ? ec.color : C.border}`, cursor: 'text' }}
      >
        <div style={{ fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          {isEditing ? (
            <input
              ref={inputRef}
              value={tempValue}
              onChange={e => setTempValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={e => e.key === 'Enter' && handleFinishEdit()}
              style={{ background: 'none', border: 'none', width: '100%', fontSize: 13, fontWeight: 800, color: ec.color, fontFamily: F.mono, outline: 'none', padding: 0 }}
            />
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: F.mono }}>{val}</div>
              <div style={{ fontSize: 6, color: C.muted3 }}>{unit}</div>
            </>
          )}
        </div>
      </div>
    );
  };

  const activeFormula = draft.activeFormula || 'Barrett';
  const eyeResults = formulaResults[activeEye] || {};
  const results = eyeResults[activeFormula] || eyeResults[activeFormula.toLowerCase()] || [];

  const selectedPowerNum = (iolResult as any)?.[activeEye]?.selectedPower || 0;
  const targetVal = parseFloat((draft as any).targetRefr || '0');
  const suggestedResult = results.length > 0 ? results.reduce((prev: any, curr: any) => 
    Math.abs((curr.refraction ?? curr.ref ?? 0) - targetVal) < Math.abs((prev.refraction ?? prev.ref ?? 0) - targetVal) ? curr : prev
  ) : null;

  const selectedResult = results.find((r: any) => Math.abs(r.power - selectedPowerNum) < 0.01) || (selectedPowerNum === 0 ? suggestedResult : null);
  const displayPower = selectedResult?.power;

  const handleLongPressEye = (eye: 'od' | 'os') => {
    toggleSurgicalEye(eye);
    const nextEye = (useSessionStore.getState().draft?.eye || 'OU').toUpperCase();
    if (nextEye === 'OD' && activeEye === 'os') setActiveEye('od');
    if (nextEye === 'OS' && activeEye === 'od') setActiveEye('os');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        @keyframes lensOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
        <EyeToggle 
          value={activeEye} 
          onChange={setActiveEye} 
          disabledEyes={disabledEyes}
          onLongPress={handleLongPressEye}
        />
      </div>


      {calcError && (
        <div style={{
          padding: '8px 14px', background: `${C.red}12`, border: `1px solid ${C.red}30`,
          borderRadius: 10, color: C.red, fontSize: 9, fontWeight: 900,
          textAlign: 'center', letterSpacing: '0.06em',
        }}>
          {calcError}
        </div>
      )}

      {/* MAIN DASHBOARD */}
      <div style={{
        background: C.card, borderRadius: 24, padding: '20px 16px', border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ec.color, opacity: 0.7 }} />

        {/* Formula Selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['Haigis', 'Barrett', 'Kane'].map(f => {
            const isSel = activeFormula.toLowerCase() === f.toLowerCase();
            return (
              <button
                key={f}
                onClick={() => { haptic.selection(); useSessionStore.getState().setDraft({ activeFormula: f }); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 12, border: `1px solid ${isSel ? C.indigo : C.border}`,
                  background: isSel ? `${C.indigo}15` : C.surface, color: isSel ? C.indigo : C.muted2,
                  fontSize: 10, fontWeight: 900, fontFamily: F.sans, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {f}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <SectionLabel color={ec.color} style={{ margin: 0, fontSize: 9, letterSpacing: '0.15em', fontWeight: 900 }}>
            {activeFormula.toUpperCase()} PREDICTION
          </SectionLabel>
          <div style={{
            fontSize: 7, fontWeight: 900, color: results.length > 0 ? C.green : C.muted3,
            background: C.surface, padding: '3px 8px', borderRadius: 20, border: `1px solid ${C.border}`,
          }}>
            {results.length > 0 ? `${results.length} VARIANTS` : 'NO DATA'}
          </div>
        </div>

        {/* 3-column: biometry | orbital IOL | keratometry */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BioField label="AL" field="bio_al" val={bio.al || '—'} unit="mm" />
            <BioField label="ACD" field="bio_acd" val={bio.acd || '—'} unit="mm" />
            <BioField label="LT" field="bio_lt" val={bio.lt || '—'} unit="mm" />
          </div>

          {/* Orbital IOL lens */}
          <div style={{ position: 'relative', width: 170, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
              border: `1px solid ${ec.border}40`, background: `radial-gradient(circle, ${ec.bg} 0%, transparent 70%)`,
            }} />
            <div style={{
              position: 'absolute', width: '90%', height: '90%', borderRadius: '50%',
              border: `1px dashed ${ec.border}60`, opacity: 0.3, animation: 'lensOrbit 30s infinite linear',
            }} />
            <div style={{
              width: 120, height: 120, borderRadius: '50%', background: C.surface,
              border: `2px solid ${draft.toricMode ? C.indigo : ec.color}`, boxShadow: `0 0 30px ${draft.toricMode ? C.indigo : ec.color}30`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 2, position: 'relative',
            }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: draft.toricMode ? C.indigo : ec.color, textTransform: 'uppercase', marginBottom: 2 }}>
                {draft.toricMode ? 'TORIC IOL' : 'IOL POWER'}
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: C.text, fontFamily: F.mono, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {displayPower ? displayPower.toFixed(2) : '—'}
                {draft.toricMode && toricResults?.[activeEye] && (
                  <span style={{ fontSize: 16, color: C.indigo, fontWeight: 900 }}>{toricResults[activeEye].best_model}</span>
                )}
              </div>
              <div style={{ position: 'absolute', bottom: -30, width: '160%', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: C.text, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {(iolResult as any)?.lens || 'NO LENS SELECTED'}
                </div>
                {draft.toricMode && toricResults?.[activeEye] && (
                  <div style={{ fontSize: 8, fontWeight: 900, color: C.indigo, marginTop: 4 }}>
                    AXIS: {toricResults[activeEye].total_steep_axis}°
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BioField label="K1" field="k1" val={eyeData.k1 || '—'} unit="D" />
            <BioField label="K2" field="k2" val={eyeData.k2 || '—'} unit="D" />
            <BioField label="Axis" field="k_ax" val={eyeData.k_ax ? `${Math.round(parseFloat(eyeData.k_ax))}°` : '—'} unit="" />
          </div>
        </div>

        {/* Predicted Refraction / Target */}
        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: `${C.green}10`, borderRadius: 16, padding: '12px', border: `1px solid ${C.green}30`, textAlign: 'center' }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: C.green, textTransform: 'uppercase', marginBottom: 4 }}>
              {draft.toricMode ? 'Predicted Refr' : 'Predicted SE'}
            </div>
            <div style={{ fontSize: draft.toricMode ? 14 : 18, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
              {(() => {
                if (!selectedResult) return '—';
                const se = selectedResult.refraction ?? selectedResult.ref ?? 0;
                
                if (draft.toricMode && toricResults?.[activeEye]) {
                  const best = toricResults[activeEye].table.find((t: any) => t.model === toricResults[activeEye].best_model);
                  if (best) {
                    const cylRes = best.residual;
                    const sphRes = se + (cylRes / 2);
                    const sphStr = (sphRes > 0 ? '+' : '') + sphRes.toFixed(2);
                    const cylStr = `-${(Math.round(cylRes * 20) / 20).toFixed(2)}`;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div>{sphStr} {cylStr}</div>
                        <div style={{ fontSize: 9, opacity: 0.7 }}>ax {best.res_axis}°</div>
                      </div>
                    );
                  }
                }
                
                return (se > 0 ? '+' : '') + se.toFixed(2);
              })()}
            </div>
          </div>
          <div style={{ background: `${C.amber}10`, borderRadius: 16, padding: '12px', border: `1px solid ${C.amber}30`, textAlign: 'center' }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: C.amber, textTransform: 'uppercase', marginBottom: 4 }}>Target</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
              {(parseFloat((draft as any).targetRefr || '0') > 0 ? '+' : '') + ((draft as any).targetRefr || '0.00')}
            </div>
          </div>
        </div>
      </div>

      {/* PREDICTION LIST */}
      <div>
        <SectionLabel color={C.muted2} style={{ marginBottom: 10, fontSize: 10, letterSpacing: '0.12em', fontWeight: 900 }}>
          {activeFormula.toUpperCase()} · PREDICTION TABLE
        </SectionLabel>
        <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', padding: '10px 16px',
            background: C.surface, borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: C.muted3 }}>IOL D</div>
            <div style={{ fontSize: 8, fontWeight: 900, color: C.muted3, textAlign: 'center' }}>PRED REF</div>
            <div style={{ fontSize: 8, fontWeight: 900, color: C.muted3, textAlign: 'right' }}>Δ TARGET</div>
          </div>

          {results.length > 0 ? (
            <div style={{ maxHeight: 260, overflowY: 'auto', scrollbarWidth: 'none' }}>
              {results.map((r: any, i: number) => {
                const targetVal = parseFloat((draft as any).targetRefr || '0');
                const rRef = r.refraction ?? r.ref ?? 0;
                
                // Авто-выбор: если еще ничего не выбрано, подсвечиваем ближайший к таргету
                const isSuggested = !selectedPowerNum && results.reduce((prev: any, curr: any) => 
                  Math.abs(curr.refraction - targetVal) < Math.abs(prev.refraction - targetVal) ? curr : prev
                ).power === r.power;

                const isSelected = Math.abs(r.power - selectedPowerNum) < 0.01 || isSuggested;
                const diff = rRef - targetVal;
                const diffColor = Math.abs(diff) < 0.25 ? C.green : Math.abs(diff) < 0.5 ? C.amber : C.muted3;

                return (
                  <div
                    key={i}
                    onClick={() => {
                      haptic.light();
                      const eyeRes = (iolResult as any)?.[activeEye] || {};
                      useSessionStore.getState().setIOLResult({
                        ...(iolResult || {}),
                        [activeEye]: {
                          ...eyeRes,
                          selectedPower: r.power,
                          expectedRefr: rRef
                        }
                      } as any);
                    }}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr',
                      padding: '13px 16px', alignItems: 'center', cursor: 'pointer',
                      borderBottom: i === results.length - 1 ? 'none' : `1px solid ${C.border}40`,
                      background: isSelected ? `${ec.color}18` : 'transparent',
                      transition: 'background 0.15s',
                      borderLeft: isSuggested && !selectedPowerNum ? `4px solid ${ec.color}` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 900, color: isSelected ? ec.color : C.text, fontFamily: F.mono }}>
                      {r.power.toFixed(2)}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: draft.toricMode ? 11 : 14, fontWeight: 800, color: isSelected ? C.text : C.muted2, fontFamily: F.mono }}>
                      {(() => {
                        if (draft.toricMode && toricResults?.[activeEye]) {
                          const best = toricResults[activeEye].table.find((t: any) => t.model === toricResults[activeEye].best_model);
                          if (best) {
                            const cylRes = best.residual;
                            const sphRes = rRef + (cylRes / 2);
                            return `${(sphRes > 0 ? '+' : '') + sphRes.toFixed(2)} -${(Math.round(cylRes * 20) / 20).toFixed(2)}`;
                          }
                        }
                        return (rRef > 0 ? '+' : '') + rRef.toFixed(2);
                      })()}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: diffColor, fontFamily: F.mono }}>
                      {(diff > 0 ? '+' : '') + diff.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted3, letterSpacing: '0.06em', marginBottom: 8 }}>
                NO DATA YET
              </div>
              <div style={{ fontSize: 9, color: C.muted3, opacity: 0.7 }}>
                Select a formula above to calculate
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TORIC SECTION */}
      {draft.toricMode && (
        <div style={{ background: C.card, borderRadius: 24, padding: '20px 16px', border: `1px solid ${C.border}`, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <SectionLabel color={C.indigo} style={{ margin: 0, fontSize: 10, letterSpacing: '0.12em', fontWeight: 900 }}>
              TORIC RECOMMENDATION
            </SectionLabel>
            {toricResults?.[activeEye] && (
              <div style={{ fontSize: 7, fontWeight: 900, color: C.indigo, background: `${C.indigo}15`, padding: '3px 8px', borderRadius: 20 }}>
                ALCON SN6AT
              </div>
            )}
          </div>

          {toricResults?.[activeEye] ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                <div style={{
                  position: 'relative', width: 130, height: 130, borderRadius: '50%',
                  background: C.surface, border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <AxisDial
                    axis={toricResults[activeEye].total_steep_axis}
                    kAxis={parseInt(eyeData.k_ax || '0')}
                    size={118} color={C.indigo} tickWidth={2.5}
                  />
                  <div style={{ position: 'absolute', bottom: -20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: C.indigo, fontFamily: F.mono }}>{toricResults[activeEye].total_steep_axis}°</div>
                    <div style={{ fontSize: 6, fontWeight: 800, color: C.muted3, textTransform: 'uppercase' }}>Impl. Axis</div>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ 
                    background: `linear-gradient(135deg, ${C.indigo}20, ${C.indigo}05)`, 
                    borderRadius: 18, padding: '14px', border: `1px solid ${C.indigo}30`, textAlign: 'center',
                    boxShadow: `0 4px 15px ${C.indigo}15`
                  }}>
                    <div style={{ fontSize: 7, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', marginBottom: 6 }}>Best Model</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: C.text, fontFamily: F.mono, letterSpacing: '0.05em' }}>
                      {toricResults[activeEye].best_model}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: C.surface, borderRadius: 14, padding: '10px 8px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', marginBottom: 2 }}>Residual</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: C.green, fontFamily: F.mono }}>
                        -{ (Math.round((toricResults[activeEye].table.find((t: any) => t.model === toricResults[activeEye].best_model)?.residual || 0) * 20) / 20).toFixed(2) }D
                      </div>
                    </div>
                    <div style={{ background: C.surface, borderRadius: 14, padding: '10px 8px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 6, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', marginBottom: 2 }}>IOL Cyl</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                        {toricResults[activeEye].table.find((t: any) => t.model === toricResults[activeEye].best_model)?.cyl_iol.toFixed(2)}D
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TORIC TABLE */}
              <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1fr 1fr 1.2fr', padding: '8px 12px', borderBottom: `1px solid ${C.border}60` }}>
                  {['MODEL', 'IOL CYL', 'RESID.', 'RES. AX'].map(h => (
                    <div key={h} style={{ fontSize: 6.5, fontWeight: 900, color: C.muted3, textAlign: h === 'RES. AX' ? 'right' : 'center' }}>{h}</div>
                  ))}
                </div>
                {toricResults[activeEye].table.map((row: any, idx: number) => {
                  const isSelected = row.model === toricResults[activeEye].best_model;
                  const resColor = row.residual < 0.5 ? C.green : row.residual < 0.75 ? C.amber : C.muted3;
                  return (
                    <div key={idx} style={{ 
                      display: 'grid', gridTemplateColumns: '0.8fr 1fr 1fr 1.2fr', padding: '10px 12px',
                      background: isSelected ? `${C.indigo}12` : 'transparent',
                      borderBottom: idx === toricResults[activeEye].table.length - 1 ? 'none' : `1px solid ${C.border}30`,
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: isSelected ? C.indigo : C.text, fontFamily: F.mono }}>{row.model}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.text, fontFamily: F.mono, textAlign: 'center' }}>{row.cyl_iol.toFixed(2)}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: resColor, fontFamily: F.mono, textAlign: 'center' }}>
                        -{ (Math.round(row.residual * 20) / 20).toFixed(2) }
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted2, fontFamily: F.mono, textAlign: 'right' }}>
                        {row.res_axis ? `${row.res_axis}°` : '—'} 
                        {row.is_wtr && <span style={{ color: C.green, marginLeft: 3 }}>WTR</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '32px 20px', textAlign: 'center', background: C.surface, borderRadius: 20, border: `1px dashed ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.muted3, fontWeight: 700, letterSpacing: '0.04em' }}>CALCULATE TO SEE TORIC RECOMMENDATIONS</div>
            </div>
          )}
          
          <div style={{ marginTop: 24, padding: '14px', background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3 }}>CORNEAL CYL</span>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.text }}>{Math.abs((parseFloat(eyeData.k1 || '0') - parseFloat(eyeData.k2 || '0'))).toFixed(2)}D</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3 }}>PCA (A-K)</span>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.indigo }}>INCLUDED</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3 }}>SIA</span>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.indigo }}>{draft.sia || '0.1'}D @ {(draft as any).incAx || '90'}°</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.muted3 }}>NOMOGRAM</span>
                  <span style={{ fontSize: 7, fontWeight: 900, color: C.green }}>WTR OPTIMIZED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
