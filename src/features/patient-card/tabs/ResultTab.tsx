import React, { useState, useRef, useEffect } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { PERIOD_KEYS, PERIOD_LABELS } from '../../../types/results';
import { AutoRepeatButton } from '../../../ui';
import { useTelegram } from '../../../hooks/useTelegram';
import { T } from '../../../constants/translations';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getVAColor = (va?: string) => {
  const n = parseFloat(va ?? '');
  if (isNaN(n)) return C.text;
  if (n >= 0.8) return C.green;
  if (n >= 0.3) return C.amber;
  return C.red;
};

const fmtVal = (val: any, isAx?: boolean, isVA?: boolean, isK?: boolean) => {
  const n = parseFloat(String(val ?? ''));
  if (isNaN(n) || val === '' || val === undefined || val === null) return '—';
  if (isAx) return Math.round(n) + '°';
  if (isVA) return n.toFixed(1);
  if (isK) return n.toFixed(2);
  return (n >= 0 ? '+' : '') + n.toFixed(2);
};

const getSE = (sph: any, cyl: any) => {
  const s = parseFloat(String(sph ?? '')) || 0;
  const c = parseFloat(String(cyl ?? '')) || 0;
  if (!s && !c) return null;
  return s + c / 2;
};

// ── Comparison table: PRE / PLAN / FACT ──────────────────────────────────────

interface CompareData {
  pre: any; plan: any; fact: any;
}

const CmpCell = ({ v, color, bold }: { v: any; color?: string; bold?: boolean }) => (
  <span style={{ fontFamily: F.mono, fontSize: 10, color: color ?? C.muted2, fontWeight: bold ? 800 : 400, textAlign: 'right', display: 'block' }}>
    {v ?? '—'}
  </span>
);

function ComparisonCard({ draft, odData, osData }: any) {

  const od  = draft.od  ?? {};
  const os  = draft.os  ?? {};
  const pOD = draft.savedPlan?.od as any;
  const pOS = draft.savedPlan?.os as any;

  const fmt  = (v: any) => fmtVal(v);
  const fmtK = (v: any) => fmtVal(v, false, false, true);
  const fmtA = (v: any) => fmtVal(v, true);
  const fmtV = (v: any) => fmtVal(v, false, true);
  const fmtSE = (sph: any, cyl: any) => {
    const se = getSE(sph, cyl);
    return se == null ? '—' : fmtVal(se);
  };

  const rows: { label: string; od: CompareData; os: CompareData; color?: string }[] = [
    { label: 'Sph', od: { pre: fmt(od.man_sph), plan: fmt(pOD?.sph), fact: fmt(odData.sph) }, os: { pre: fmt(os.man_sph), plan: fmt(pOS?.sph), fact: fmt(osData.sph) } },
    { label: 'Cyl', od: { pre: fmt(od.man_cyl), plan: fmt(pOD?.cyl), fact: fmt(odData.cyl) }, os: { pre: fmt(os.man_cyl), plan: fmt(pOS?.cyl), fact: fmt(osData.cyl) } },
    { label: 'Ax',  od: { pre: fmtA(od.man_ax), plan: fmtA(pOD?.ax), fact: fmtA(odData.ax) }, os: { pre: fmtA(os.man_ax), plan: fmtA(pOS?.ax), fact: fmtA(osData.ax) } },
    { label: 'SE',  od: { pre: fmtSE(od.man_sph, od.man_cyl), plan: fmtSE(pOD?.sph, pOD?.cyl), fact: fmtSE(odData.sph, odData.cyl) }, os: { pre: fmtSE(os.man_sph, os.man_cyl), plan: fmtSE(pOS?.sph, pOS?.cyl), fact: fmtSE(osData.sph, osData.cyl) }, color: C.green },
    { label: 'VA',  od: { pre: fmtV(od.uva), plan: null, fact: fmtV(odData.va) }, os: { pre: fmtV(os.uva), plan: null, fact: fmtV(osData.va) }, color: C.green },
    { label: 'K1',  od: { pre: fmtK(od.k1), plan: null, fact: fmtK(odData.k1) }, os: { pre: fmtK(os.k1), plan: null, fact: fmtK(osData.k1) }, color: C.amber },
    { label: 'K2',  od: { pre: fmtK(od.k2), plan: null, fact: fmtK(odData.k2) }, os: { pre: fmtK(os.k2), plan: null, fact: fmtK(osData.k2) }, color: C.amber },
  ];

  const grid = '28px 1fr 1fr 1fr 6px 1fr 1fr 1fr';

  return (
    <div style={{ background: C.card, borderRadius: 16, padding: '10px 12px', border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '0 4px', marginBottom: 6, alignItems: 'center' }}>
        <span />
        {/* OD */}
        <span style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 900, color: C.od, textAlign: 'center', gridColumn: '2/5' }}>OD</span>
        <span />
        {/* OS */}
        <span style={{ fontFamily: F.mono, fontSize: 8, fontWeight: 900, color: C.os, textAlign: 'center', gridColumn: '6/9' }}>OS</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '0 4px', marginBottom: 4 }}>
        <span />
        {['PRE','PLAN','FACT','','PRE','PLAN','FACT'].map((h, hi) => (
          <span key={hi} style={{ fontFamily: F.mono, fontSize: 7, fontWeight: 900, color: h === 'FACT' ? C.text : h === 'PLAN' ? C.indigo : C.muted3, textAlign: 'right', display: 'block' }}>{h}</span>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: C.border, opacity: 0.3, marginBottom: 4 }} />

      {/* Rows */}
      {rows.map((row, i) => (
        <div key={row.label}>
          {(row.label === 'SE' || row.label === 'K1') && <div style={{ height: 1, background: C.border, opacity: 0.2, margin: '3px 0' }} />}
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '0 4px', alignItems: 'center', padding: '1px 0' }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: row.color ?? C.muted2, textTransform: 'uppercase' }}>{row.label}</span>
            <CmpCell v={row.od.pre} />
            <CmpCell v={row.od.plan} color={C.indigo} />
            <CmpCell v={row.od.fact} color={row.color ?? C.text} bold />
            <span />
            <CmpCell v={row.os.pre} />
            <CmpCell v={row.os.plan} color={C.indigo} />
            <CmpCell v={row.os.fact} color={row.color ?? C.text} bold />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Compact inline field: [−] value [+] ──────────────────────────────────────

interface InlineFieldProps {
  val: any;
  color: string;
  isAx?: boolean;
  isVA?: boolean;
  isK?: boolean;
  editing: boolean;
  tempVal: string;
  onStartEdit: () => void;
  onTempChange: (v: string) => void;
  onFinish: () => void;
  onStep: (dir: number) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
}

const InlineField = ({ val, color, isAx, isVA, isK, editing, tempVal, onStartEdit, onTempChange, onFinish, onStep, inputRef, disabled }: InlineFieldProps) => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: disabled ? C.surface2 : C.surface,
      borderRadius: 8, border: `1px solid ${editing ? color : C.border}`,
      padding: '0 2px', height: 29, opacity: disabled ? 0.35 : 1,
    }}>
      <AutoRepeatButton
        onTrigger={() => !disabled && onStep(-1)}
        style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 16, padding: '6px 9px', margin: '-6px -4px', cursor: disabled ? 'default' : 'pointer' }}
      >−</AutoRepeatButton>
      <div onClick={() => !disabled && onStartEdit()} style={{ flex: 1, textAlign: 'center', cursor: disabled ? 'default' : 'text' }}>
        {editing ? (
          <input
            ref={inputRef}
            value={tempVal}
            onChange={e => onTempChange(e.target.value)}
            onBlur={onFinish}
            onKeyDown={e => e.key === 'Enter' && onFinish()}
            inputMode="decimal"
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', color, fontSize: 12, fontWeight: 900, fontFamily: F.mono, outline: 'none', padding: 0 }}
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 900, fontFamily: F.mono, color: isVA ? getVAColor(String(val)) : color }}>
            {fmtVal(val, isAx, isVA, isK)}
          </span>
        )}
      </div>
      <AutoRepeatButton
        onTrigger={() => !disabled && onStep(1)}
        style={{ background: 'none', border: 'none', color: C.muted3, fontSize: 16, padding: '6px 9px', margin: '-6px -4px', cursor: disabled ? 'default' : 'pointer' }}
      >+</AutoRepeatButton>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export function ResultTab({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) {
  const { draft, setPeriodEyeField, iolResult, toricResults } = useSessionStore();
  const { activePeriod, setActivePeriod } = useUIStore();
  const { language } = useClinicStore();
  const t = T(language);
  const { haptic } = useTelegram();

  const [editing, setEditing] = useState<{ eye: string; field: string } | null>(null);
  const [tempVal, setTempVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!draft) return null;

  const isCat = draft.type === 'cataract';
  const periodData = (draft.periods?.[activePeriod] ?? {}) as any;
  const odData = periodData.od ?? {};
  const osData = periodData.os ?? {};
  const ouData = periodData.ou ?? {};

  const opEye = (draft.eye || 'OU').toUpperCase();
  const odDisabled = opEye === 'OS';
  const osDisabled = opEye === 'OD';

  const setField = (eye: string, field: string, val: string) =>
    setPeriodEyeField(activePeriod, eye as any, field as any, val);

  const startEdit = (eye: string, field: string, val: any) => {
    setEditing({ eye, field });
    setTempVal(String(val ?? ''));
  };

  const isKVal = (field: string) => field === 'k1' || field === 'k2';

  const finishEdit = () => {
    if (editing) {
      let val = tempVal;
      const n = parseFloat(val);
      // VA и K-значения не могут быть отрицательными
      if ((editing.field === 'va' || isKVal(editing.field)) && !isNaN(n) && n < 0)
        val = '0';
      setField(editing.eye, editing.field, val);
    }
    setEditing(null);
  };

  const handleStep = (eye: string, field: string, dir: number) => {
    const pd = (useSessionStore.getState().draft?.periods?.[activePeriod] ?? {}) as any;
    const ed = pd[eye] ?? {};
    const isAx = field === 'ax' || field === 'k_ax';
    const isVA = field === 'va';
    const isK = isKVal(field);
    const step = isAx ? 5 : isVA ? 0.05 : isK ? 0.25 : 0.25;
    const cur = parseFloat(ed[field] || '0') || 0;
    // K-поля: если пусто и нажали +, стартуем с 35D
    let n = (isK && cur === 0 && dir === 1) ? 35.0 : cur + dir * step;
    if (isAx) { if (n < 0) n += 180; if (n >= 180) n -= 180; }
    // VA и K не могут быть отрицательными
    if ((isVA || isK) && n < 0) n = 0;
    const nv = n.toFixed(isAx ? 0 : isVA ? 2 : 2);
    const showPlus = !isAx && !isVA && !isK && n >= 0;
    setField(eye, field, isAx ? nv : (n > 25 ? nv : (showPlus ? '+' : '') + nv));
    haptic.selection();
  };

  const isEdit = (eye: string, field: string) => editing?.eye === eye && editing?.field === field;

  // Row helper: renders label + OD cell + OS cell
  const Row = ({ label, field, isAx, isVA, isK, color, labelColor }: any) => {
    const odColor = color ?? eyeColors('od').color;
    const osColor = color ?? eyeColors('os').color;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: labelColor ?? C.muted2, textTransform: 'uppercase', textAlign: 'right' }}>{label}</span>
        <InlineField
          val={odData[field]} color={odColor} isAx={isAx} isVA={isVA} isK={isK}
          editing={isEdit('od', field)} tempVal={tempVal}
          onStartEdit={() => startEdit('od', field, odData[field])}
          onTempChange={setTempVal} onFinish={finishEdit}
          onStep={dir => handleStep('od', field, dir)}
          inputRef={inputRef} disabled={odDisabled}
        />
        <InlineField
          val={osData[field]} color={osColor} isAx={isAx} isVA={isVA} isK={isK}
          editing={isEdit('os', field)} tempVal={tempVal}
          onStartEdit={() => startEdit('os', field, osData[field])}
          onTempChange={setTempVal} onFinish={finishEdit}
          onStep={dir => handleStep('os', field, dir)}
          inputRef={inputRef} disabled={osDisabled}
        />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
        {PERIOD_KEYS.map(p => {
          const active = activePeriod === p;
          const hasData = !!(draft.periods?.[p]?.od?.sph || draft.periods?.[p]?.od?.va || draft.periods?.[p]?.os?.sph || draft.periods?.[p]?.os?.va);
          return (
            <button key={p} onClick={() => { haptic.selection(); setActivePeriod(p); }}
              style={{ flex: 1, minWidth: 44, padding: '5px 2px', borderRadius: 12, border: `2px solid ${active ? C.indigo : hasData ? `${C.indigo}40` : C.border}`, background: active ? `${C.indigo}15` : 'transparent', color: active ? C.indigo : hasData ? C.text : C.muted3, fontSize: 9.5, fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
              {PERIOD_LABELS[p]}
              {hasData && !active && <span style={{ position: 'absolute', top: 2, right: 3, width: 3.5, height: 3.5, borderRadius: '50%', background: C.indigo }} />}
            </button>
          );
        })}
      </div>

      {/* IOL Summary (cataract) */}
      {isCat && (
        <div style={{ background: C.surface, borderRadius: 16, padding: '10px 14px', border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', marginBottom: 2 }}>{t.implantedIOL}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.text }}>{iolResult?.lens || '—'}</div>
            {toricResults?.[opEye === 'OS' ? 'os' : 'od']?.best_model && (
              <div style={{ fontSize: 9, color: C.indigo, fontWeight: 700 }}>T: {toricResults[opEye === 'OS' ? 'os' : 'od'].best_model}</div>
            )}
          </div>
          <div style={{ background: `${C.indigo}15`, borderRadius: 12, padding: '8px 14px', textAlign: 'center', border: `1px solid ${C.indigo}30` }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', marginBottom: 2 }}>{t.power}</div>
            <div style={{ fontFamily: F.mono, fontSize: 20, fontWeight: 900, color: C.text }}>
              {(() => {
                const ek = opEye === 'OS' ? 'os' : 'od';
                const p = (iolResult as any)?.[ek]?.selectedPower ?? (iolResult as any)?.power;
                if (p == null) return '—';
                const n = parseFloat(String(p));
                return isNaN(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(2);
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Comparison table (refraction only) */}
      {!isCat && (
        <ComparisonCard draft={draft} odData={odData} osData={osData} />
      )}

      {/* Main entry card */}
      <div style={{ background: C.card, borderRadius: 20, padding: '10px 12px 12px', border: `1px solid ${C.border}` }}>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <span />
          <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 900, color: C.od, letterSpacing: '0.06em' }}>OD</div>
          <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 900, color: C.os, letterSpacing: '0.06em' }}>OS</div>
        </div>

        {/* OU VA */}
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>OU</span>
          <InlineField
            val={ouData.va} color={getVAColor(String(ouData.va))} isVA
            editing={isEdit('ou', 'va')} tempVal={tempVal}
            onStartEdit={() => startEdit('ou', 'va', ouData.va)}
            onTempChange={setTempVal} onFinish={finishEdit}
            onStep={dir => handleStep('ou', 'va', dir)}
            inputRef={inputRef}
          />
        </div>

        {/* VA row — вызов как функция, не JSX-компонент (иначе ремонт на каждый ввод) */}
        {Row({ label: 'VA', field: 'va', isVA: true })}

        {/* Divider */}
        <div style={{ height: 1, background: C.border, opacity: 0.3, margin: '6px 0' }} />

        {/* Refraction */}
        {Row({ label: 'Sph', field: 'sph' })}
        <div style={{ height: 3 }} />
        {Row({ label: 'Cyl', field: 'cyl' })}
        <div style={{ height: 3 }} />
        {Row({ label: 'Ax', field: 'ax', isAx: true })}

        {/* Divider */}
        <div style={{ height: 1, background: C.border, opacity: 0.3, margin: '6px 0' }} />

        {/* Keratometry */}
        {Row({ label: 'K1', field: 'k1', isK: true, labelColor: C.amber, color: C.amber })}
        <div style={{ height: 3 }} />
        {Row({ label: 'K2', field: 'k2', isK: true, labelColor: C.amber, color: C.amber })}
        <div style={{ height: 3 }} />
        {Row({ label: 'Kax', field: 'k_ax', isAx: true, labelColor: C.amber, color: C.amber })}

        {/* Notes */}
        <div style={{ marginTop: 10 }}>
          <textarea
            placeholder={t.clinicalNotes}
            value={odData.note || ''}
            onChange={e => setField('od', 'note', e.target.value)}
            style={{ width: '100%', minHeight: 36, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '6px 10px', color: C.text, fontFamily: F.sans, fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Save */}
      <div style={{ padding: '4px 0 16px' }}>
        <button
          onClick={() => { haptic.notification('success'); onSave(); }}
          disabled={isSaving}
          style={{ width: '100%', background: isSaving ? C.surface : `linear-gradient(135deg, ${C.green} 0%, #10B981 100%)`, border: 'none', borderRadius: 18, padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: isSaving ? C.muted3 : '#fff', fontSize: 15, fontWeight: 900, boxShadow: isSaving ? 'none' : `0 8px 20px ${C.green}30`, cursor: 'pointer', transition: 'all 0.2s' }}>
          {isSaving ? t.loading : t.finishSave.toUpperCase()}
        </button>
      </div>

    </div>
  );
}
