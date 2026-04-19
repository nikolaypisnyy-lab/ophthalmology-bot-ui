import React, { useState } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { IOL_DB, searchIOL } from '../../../constants/iol-db';
import { validateBiometry } from '../../../calculators/iolSrkt';
import { toricIndication } from '../../../calculators/validators';
import { calculateIOL } from '../../../api/calculate';
import { DField } from '../../../ui/DField';
import { WheelField } from '../../../ui/WheelField';
import { Btn } from '../../../ui/Btn';
import { SectionLabel, Divider } from '../../../ui/SectionLabel';
import { EyeToggle } from '../../../ui/EyeToggle';
import { ToricSchematic } from '../../../ui/ToricSchematic';
import { newBiometryData } from '../../../types/iol';
import type { IOLFormulaResult } from '../../../types/iol';

// Результаты по формулам на один глаз: { 'Barrett Universal II': {...}, 'Kane Formula': {...}, ... }
type FormulaMap = Record<string, IOLFormulaResult>;
type EyeFormulaMap = { od: FormulaMap; os: FormulaMap };

// ── Колонка одной формулы ────────────────────────────────────────────────────

function FormulaColumn({
  formula,
  result,
  eye,
  selectedFormula,
  selectedPower,
  toricCyl,
  toricAx,
  onSelectPower,
  onSelectToric,
}: {
  formula: string;
  result: IOLFormulaResult;
  eye: 'od' | 'os';
  selectedFormula?: string;
  selectedPower?: number;
  toricCyl?: string;
  toricAx?: string;
  onSelectPower: (power: number, formula: string, ref: number) => void;
  onSelectToric: (cyl: number, ax: number, residual: string) => void;
}) {
  const ec = eyeColors(eye);
  const isBest = selectedFormula === formula;
  const isToricCol = !!result._toricMode;
  const shortName = formula.replace(' Universal II', '').replace(' Formula', '');

  if (isToricCol) {
    const toricTable = result.toric_table ?? [];
    const bestCyl = result.best_cyl;
    const nonToricRow = toricTable.find(r => r.cyl_power === 0) ?? toricTable[0];
    const implAxis = nonToricRow ? Math.round(nonToricRow.axis) : null;
    const selCyl = toricCyl !== undefined && toricCyl !== '' ? parseFloat(toricCyl) : bestCyl;

    return (
      <div style={{
        flex: '1 1 0', minWidth: 0,
        background: C.surface2,
        border: `1.5px solid ${C.amber}`,
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '7px 7px 5px', borderBottom: `1px solid rgba(245,158,11,.3)`, background: 'rgba(245,158,11,.06)' }}>
          <div style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 700, color: C.amber, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
            Kane Toric · ИОЛ
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1 }}>
            {selCyl != null ? `${selCyl > 0 ? '+' : ''}${selCyl.toFixed(2)}` : '—'}
            <span style={{ fontSize: 9, color: C.muted, marginLeft: 2 }}>D</span>
            {implAxis != null && <span style={{ fontSize: 14, color: C.yellow, marginLeft: 6 }}>@{implAxis}°</span>}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 7, color: C.amber, marginTop: 2, fontWeight: 600 }}>
            Остаток @ Ось
          </div>
        </div>
        {/* Toric table */}
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {toricTable.map((row, idx) => {
            const isBestRow = bestCyl != null && Math.abs(row.cyl_power - bestCyl) < 0.01;
            const sel = selCyl != null && Math.abs(row.cyl_power - selCyl) < 0.01;
            const resColor = row.residual_cyl <= 0.25 ? C.green : row.residual_cyl <= 0.5 ? C.yellow : C.muted2;
            const resAx = (Math.round(row.axis) + 90) % 180 || 180;
            return (
              <div
                key={idx}
                onClick={() => {
                  const ax = implAxis ?? Math.round(row.axis);
                  onSelectToric(row.cyl_power, ax, `-${row.residual_cyl.toFixed(2)} @ ${resAx}°`);
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 7px', cursor: 'pointer',
                  background: sel ? 'rgba(245,158,11,.17)' : isBestRow ? 'rgba(255,255,255,.04)' : 'transparent',
                  borderTop: `1px solid rgba(255,255,255,.04)`,
                }}
              >
                <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: isBestRow || sel ? 700 : 400, color: sel ? C.amber : isBestRow ? C.text : C.muted }}>
                  {row.cyl_power > 0 ? '+' : ''}{row.cyl_power.toFixed(2)}D
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: resColor, whiteSpace: 'nowrap' }}>
                  -{row.residual_cyl.toFixed(2)}@{resAx}°
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Spherical formula column
  const displayedPwr = isBest && selectedPower != null ? selectedPower : result.p_emmetropia;
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      background: isBest ? ec.bg : C.surface2,
      border: `1.5px solid ${isBest ? ec.color : C.border}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '7px 7px 5px', borderBottom: `1px solid ${isBest ? ec.color + '50' : C.border}` }}>
        <div style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 700, color: isBest ? ec.color : C.muted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shortName}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1 }}>
          {displayedPwr > 0 ? '+' : ''}{displayedPwr.toFixed(1)}
          <span style={{ fontSize: 9, color: C.muted, marginLeft: 2 }}>D</span>
        </div>
        {isBest && <div style={{ fontFamily: F.sans, fontSize: 7, fontWeight: 800, color: ec.color, letterSpacing: '.08em', marginTop: 2 }}>ВЫБРАНА</div>}
      </div>
      {/* Power table */}
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {result.table.map(row => {
          const sel = isBest && selectedPower != null && Math.abs(row.power - selectedPower) < 0.01;
          const isEmm = Math.abs(row.ref) <= 0.12;
          const refColor = Math.abs(row.ref) <= 0.25 ? C.green : Math.abs(row.ref) <= 0.5 ? C.yellow : C.muted2;
          return (
            <div
              key={row.power}
              onClick={() => onSelectPower(row.power, formula, row.ref)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 7px', cursor: 'pointer',
                background: sel ? ec.color + '28' : isEmm ? 'rgba(255,255,255,.04)' : 'transparent',
                borderTop: `1px solid rgba(255,255,255,.04)`,
              }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: isEmm || sel ? 700 : 400, color: sel ? ec.color : isEmm ? C.text : C.muted, whiteSpace: 'nowrap' }}>
                {row.power > 0 ? '+' : ''}{row.power.toFixed(1)}
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, color: refColor, whiteSpace: 'nowrap' }}>
                {row.ref > 0 ? '+' : ''}{row.ref.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CalcTab ───────────────────────────────────────────────────────────────────

export function CalcTab() {
  const { draft, setDraft, setBioField, setIOLResult, setIOLLoading, iolResult, iolLoading, iolProgress, formulaResults, setFormulaResults } = useSessionStore();
  const { activeEye, setActiveEye } = useUIStore();

  const [lensSearch, setLensSearch] = useState('');
  const [lensOpen, setLensOpen] = useState(false);

  if (!draft) return null;

  const lensName = (draft as any)._lensName ?? '';
  const aConst   = (draft as any).aConst ?? '';
  const aConstK  = (draft as any).aConstKane ?? aConst;
  const targetRefr = draft.targetRefr ?? '0';
  const toricMode = !!draft.toricMode;
  const sia = draft.sia ?? '0.1';
  const siaAx = draft.siaAx ?? '90';

  const filteredLenses = searchIOL(lensSearch);

  const pickLens = (name: string, a: number, aKane: number) => {
    setDraft({
      _lensName: name,
      aConst: a > 0 ? String(a) : aKane > 0 ? String(aKane) : aConst,
      aConstKane: aKane > 0 ? String(aKane) : aConst,
    } as any);
    setLensOpen(false);
    setLensSearch('');
  };

  const runCalc = async () => {
    const aConstN = parseFloat(aConst) || 119.3;
    const aConstKN = parseFloat(aConstK) || aConstN;
    const target = parseFloat(targetRefr) || 0;

    const localResults: EyeFormulaMap = { od: {}, os: {} };
    let hasData = true; // Будем ждать расчетов от сервера

    setFormulaResults(localResults);
    setIOLLoading(true, 0);

    const start = Date.now();
    const interval = setInterval(() => {
      const pct = Math.min(88, Math.round(88 * (1 - Math.exp(-(Date.now() - start) / 15000))));
      setIOLLoading(true, pct);
    }, 300);

    try {
      const reqData: any = {
        use_barrett: true,
        use_kane: true,
        use_kane_toric: toricMode,
        name: draft.name ?? 'Patient',
        age: draft.age ?? '',
        sex: draft.sex ?? '',
        const_a_barrett: aConstN,
        const_a_kane: aConstKN,
        kane_sia: isNaN(parseFloat(sia)) ? 0.1 : parseFloat(sia),
        kane_incision: isNaN(parseInt(siaAx)) ? 90 : parseInt(siaAx),
      };

      (['od', 'os'] as const).forEach(ek => {
        const bio = draft[`bio_${ek}`] ?? newBiometryData();
        const al = parseFloat(bio.al);
        const k1 = parseFloat(bio.k1);
        const k2 = parseFloat(bio.k2);
        if (al && k1 && k2) {
          reqData[ek] = { al, k1, k2, acd: parseFloat(bio.acd) || 0, k1_ax: parseFloat(bio.k1_ax) || 0, target };
        }
      });

      const res = await calculateIOL(reqData);

      if (res.results) {
        const finalResults: EyeFormulaMap = { od: {}, os: {} };

        (['od', 'os'] as const).forEach(ek => {
          const barrEye = res.results?.barrett?.[ek];
          const kaneEye = res.results?.kane?.[ek];

          if (barrEye?.table) {
            finalResults[ek]['Barrett Universal II'] = barrEye;
          }
          if (kaneEye?.table) {
            if (toricMode && kaneEye.toric_table?.length) {
              finalResults[ek]['Kane Toric'] = { ...kaneEye, _toricMode: true };
            } else {
              finalResults[ek]['Kane Formula'] = kaneEye;
            }
          }
        });

        setFormulaResults(finalResults);

        // Устанавливаем лучший результат в iolResult
        const buildEyeResult = (ek: 'od' | 'os') => {
          const frm = finalResults[ek];
          const bio = draft[`bio_${ek}`] ?? newBiometryData();
          const al = parseFloat(bio.al);
          const isLongEye = al > 25.0;

          // Приоритет: Kane для длинного глаза, иначе Barrett
          let sphereSource = frm['Barrett Universal II'] ?? frm['Kane Formula'];
          if (isLongEye && frm['Kane Formula']) {
            sphereSource = frm['Kane Formula'];
          } else if (isLongEye && frm['Kane Toric']) {
            sphereSource = frm['Kane Toric'];
          }
          
          if (!sphereSource) return undefined;
          
          // Определяем название формулы для отображения
          let bestName = 'Barrett Universal II';
          if (isLongEye && (frm['Kane Formula'] || frm['Kane Toric'])) {
            bestName = toricMode ? 'Kane Toric' : 'Kane Formula';
          } else if (toricMode && frm['Kane Toric']) {
            bestName = 'Kane Toric + Barrett';
          } else if (!frm['Barrett Universal II'] && frm['Kane Formula']) {
            bestName = 'Kane Formula';
          }

          // Торик
          const kaneEye = res.results?.kane?.[ek];
          let toricAx: number | undefined;
          let toricPower: number | undefined;
          let toricResidual: string | undefined;
          if (toricMode && kaneEye?.best_cyl != null) {
            toricPower = kaneEye.best_cyl;
            const nonToricRow = (kaneEye.toric_table ?? []).find(r => r.cyl_power === 0) ?? kaneEye.toric_table?.[0];
            toricAx = nonToricRow ? Math.round(nonToricRow.axis) : undefined;
            const bestRow = (kaneEye.toric_table ?? []).find(r => Math.abs(r.cyl_power - kaneEye.best_cyl!) < 0.01);
            if (bestRow) {
              const resAx = (Math.round(bestRow.axis) + 90) % 180 || 180;
              toricResidual = `-${bestRow.residual_cyl.toFixed(2)} @ ${resAx}°`;
            }
          }

          return {
            p_emmetropia: sphereSource.p_emmetropia,
            table: sphereSource.table,
            formula: bestName,
            formulas: frm,
            toricPower,
            toricAx,
            toricResidual,
          };
        };

        const odResult = buildEyeResult('od');
        const osResult = buildEyeResult('os');
        setIOLResult({
          od: odResult,
          os: osResult,
          lens: lensName,
          aConst: aConstN,
          targetRefr: target,
          timestamp: new Date().toISOString(),
          source: 'api',
        });
        if (!odResult && osResult) setActiveEye('os');
        else if (odResult && !osResult) setActiveEye('od');
      }
    } catch {
      // Ошибка расчёта
    } finally {
      clearInterval(interval);
      setIOLLoading(false, 100);
    }
  };

  // Выбор мощности пользователем
  const handleSelectPower = (eye: 'od' | 'os', power: number, formula: string, ref: number) => {
    setIOLResult({
      ...(iolResult ?? { lens: lensName, aConst: parseFloat(aConst) || 119.3, targetRefr: parseFloat(targetRefr) || 0, timestamp: new Date().toISOString(), source: 'local' }),
      [eye]: {
        ...(iolResult?.[eye] ?? {}),
        selectedPower: power,
        selectedFormula: formula,
        expectedRefr: ref,
        p_emmetropia: power,
        formula,
      },
    });
  };

  const handleSelectToric = (eye: 'od' | 'os', cyl: number, ax: number, residual: string) => {
    setDraft({ toricCyl: String(cyl), toricAx: String(ax), toricResidual: residual });
    setIOLResult({
      ...(iolResult ?? { lens: lensName, aConst: parseFloat(aConst) || 119.3, targetRefr: parseFloat(targetRefr) || 0, timestamp: new Date().toISOString(), source: 'local' }),
      [eye]: {
        ...(iolResult?.[eye] ?? {}),
        toricPower: cyl,
        toricAx: ax,
        toricResidual: residual,
      },
    });
  };

  const bioKey = `bio_${activeEye}` as 'bio_od' | 'bio_os';
  const bio = draft[bioKey] ?? newBiometryData();
  const ec = eyeColors(activeEye);
  const eyeResult = iolResult?.[activeEye];
  const eyeFormulas = formulaResults[activeEye] ?? {};
  const hasFormulas = Object.keys(eyeFormulas).length > 0;

  const bioValidation = validateBiometry(bio);
  const toricHint = toricIndication(bio.k1, bio.k2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Переключатель глаз (всегда сверху) */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle value={activeEye} onChange={setActiveEye} />
      </div>

      {/* Выбор линзы */}
      <div>
        <SectionLabel>ИОЛ</SectionLabel>
        <button
          onClick={() => setLensOpen(v => !v)}
          style={{
            width: '100%', textAlign: 'left',
            background: C.surface2, border: `1px solid ${C.border2}`,
            borderRadius: 12, padding: '10px 14px',
            fontFamily: F.sans, fontSize: 13,
            color: lensName ? C.text : C.muted,
            cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{lensName || 'Выбрать линзу...'}</span>
          <span style={{ color: C.muted, fontSize: 10 }}>{lensOpen ? '▲' : '▼'}</span>
        </button>

        {lensOpen && (
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 4, overflow: 'hidden' }}>
            <input
              value={lensSearch}
              onChange={e => setLensSearch(e.target.value)}
              placeholder="Поиск ИОЛ..."
              autoFocus
              style={{
                width: '100%', padding: '10px 14px',
                background: 'transparent', border: 'none',
                borderBottom: `1px solid ${C.border}`,
                fontFamily: F.sans, fontSize: 13, color: C.text,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredLenses.slice(0, 30).map(l => (
                <button
                  key={l.name}
                  onClick={() => pickLens(l.name, l.a, l.a_kane)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '9px 14px', border: 'none',
                    background: l.name === lensName ? C.accentLt : 'transparent',
                    color: l.name === lensName ? C.accent : C.text,
                    fontFamily: F.sans, fontSize: 13, cursor: 'pointer', display: 'block',
                  }}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* A-константы + целевая рефракция */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <DField label="A-Barrett" value={aConst} onChange={v => setDraft({ aConst: v } as any)} type="number" step=".01" />
        <DField label="A-Kane" value={aConstK} onChange={v => setDraft({ aConstKane: v } as any)} type="number" step=".01" />
        <WheelField label="Цель D" value={String(targetRefr)} onChange={v => setDraft({ targetRefr: v })} min={-4} max={2} step={0.25} />
      </div>

      {/* Торический расчёт + SIA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.muted2 }}>Торический расчёт</span>
          <button
            onClick={() => setDraft({ toricMode: !toricMode })}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none',
              background: toricMode ? C.amber : C.surface3,
              cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: toricMode ? 22 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'left .2s',
            }} />
          </button>
        </div>

        {toricMode && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
            background: 'rgba(245,158,11,.08)', border: `1px solid rgba(245,158,11,.35)`,
            borderRadius: 12, padding: '10px',
          }}>
            <DField label="SIA D" value={sia} onChange={v => setDraft({ sia: v })} type="number" step=".05" accentColor={C.amber} />
            <DField label="Ось разреза °" value={siaAx} onChange={v => setDraft({ siaAx: v })} type="number" accentColor={C.amber} />
          </div>
        )}
      </div>

      {/* Кнопка расчёта */}
      <Btn variant="primary" onClick={runCalc} disabled={iolLoading} full>
        {iolLoading ? `Расчёт... ${iolProgress}%` : 'Рассчитать ИОЛ'}
      </Btn>

      {iolLoading && (
        <div style={{ height: 3, background: C.surface2, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${iolProgress}%`, background: C.accent, borderRadius: 2, transition: 'width .3s ease' }} />
        </div>
      )}

      {/* Предупреждения */}
      {bioValidation.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bioValidation.warnings.map((w, i) => (
            <div key={i} style={{ background: C.yellowLt, border: `1px solid ${C.yellow}40`, borderRadius: 10, padding: '7px 12px', fontFamily: F.sans, fontSize: 11, color: C.yellow }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* Подсказка торика */}
      {toricHint.indicated && !toricMode && !iolLoading && (
        <div style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 10, padding: '8px 12px', fontFamily: F.sans, fontSize: 11, color: C.amber }}>
          {toricHint.recommended
            ? `★ Показана торическая ИОЛ — астигматизм ${toricHint.delta.toFixed(2)} D`
            : `○ Рекомендуется торическая ИОЛ — астигматизм ${toricHint.delta.toFixed(2)} D`
          }
        </div>
      )}

      <Divider my={0} />

      {/* Результаты */}
      {hasFormulas && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 16, background: ec.color, borderRadius: 2 }} />
            <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '.02em' }}>
              {activeEye.toUpperCase()} — {activeEye === 'od' ? 'Правый глаз' : 'Левый глаз'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {['Barrett Universal II', 'Kane Toric', 'Kane Formula'].map(name => {
              // В торическом режиме показываем только Barrett (сферу) и Kane Toric
              if (toricMode) {
                if (name === 'Kane Formula') return null;
                // Если считаем торику, Barrett всегда есть, а Kane Toric появится если успешно распарсился
              } else {
                // В обычном режиме убираем торическую колонку
                if (name === 'Kane Toric') return null;
              }

              const res = formulaResults[activeEye][name];
              if (!res) return null;
              return (
                <FormulaColumn
                  key={name}
                  formula={name}
                  result={res}
                  eye={activeEye}
                  selectedFormula={eyeResult?.selectedFormula ?? eyeResult?.formula}
                  selectedPower={eyeResult?.selectedPower ?? eyeResult?.p_emmetropia}
                  toricCyl={draft.toricCyl}
                  toricAx={draft.toricAx}
                  onSelectPower={(p, f, r) => handleSelectPower(activeEye, p, f, r)}
                  onSelectToric={(c, a, res) => handleSelectToric(activeEye, c, a, res)}
                />
              );
            })}
          </div>

          {/* Торическая схема */}
          {eyeResult?.toricAx != null && (
            <div style={{ display: 'flex', gap: 12, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <ToricSchematic
                eye={activeEye}
                toricAx={eyeResult.toricAx}
                incisionAx={parseInt(siaAx) || null}
                size={140}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: F.sans, fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase' }}>Рекомендация Toric</span>
                  {eyeResult.toricPower != null && (
                    <div style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 700, color: C.yellow }}>
                      {eyeResult.toricPower.toFixed(2)} D @ {eyeResult.toricAx}°
                    </div>
                  )}
                  {draft.toricResidual && (
                    <div style={{ fontFamily: F.mono, fontSize: 12, color: C.green, fontWeight: 600 }}>
                      {draft.toricResidual}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
