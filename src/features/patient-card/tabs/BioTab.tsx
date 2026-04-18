import React, { useState } from 'react';
import { C, F, eyeColors } from '../../../constants/design';
import { useSessionStore } from '../../../store/useSessionStore';
import { useUIStore } from '../../../store/useUIStore';
import { DField } from '../../../ui/DField';
import { WheelField } from '../../../ui/WheelField';
import { EyeToggle } from '../../../ui/EyeToggle';
import { SectionLabel, Divider } from '../../../ui/SectionLabel';
import { newEyeData } from '../../../types/refraction';
import { newBiometryData } from '../../../types/iol';

// ── Секция рефракции одного глаза ─────────────────────────────────────────────

function RefractionEye({ eye }: { eye: 'od' | 'os' }) {
  const { draft, setEyeField } = useSessionStore();
  const { targetSection, setTargetSection } = useUIStore();
  const ec = eyeColors(eye);
  const data = draft?.[eye] ?? newEyeData();
  const set = (f: string, v: string) => setEyeField(eye, f, v);
  const [pentaTab, setPentaTab] = useState<'Total' | 'Ant' | 'Post'>('Total');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* МАНИФЕСТ */}
      <div style={{ background: 'rgba(255,255,255,.03)', padding: 12, borderRadius: 16, border: `1px solid ${C.border}` }}>
        <SectionLabel 
          color={ec.color} style={{ marginBottom: 10 }}
          active={targetSection === 'manifest'}
          onClick={() => setTargetSection(targetSection === 'manifest' ? null : 'manifest')}
        >МАНИФЕСТ</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 1fr) 1.5fr 1.5fr 1.5fr', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DField label="UVA" value={data.uva} onChange={v => set('uva', v)} placeholder="0.0" accentColor={C.red} mini />
            <DField label="BCVA" value={data.bcva} onChange={v => set('bcva', v)} placeholder="1.0" accentColor={C.green} mini />
          </div>
          <WheelField label="SPH" value={data.man_sph} onChange={v => set('man_sph', v)} min={-20} max={10} step={0.25} accentColor={ec.color} />
          <WheelField label="CYL" value={data.man_cyl} onChange={v => set('man_cyl', v)} min={-8} max={4} step={0.25} accentColor={ec.color} />
          <DField label="AX" value={data.man_ax} onChange={v => set('man_ax', v)} type="number" unit="°" accentColor={ec.color} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* УЗКИЙ */}
        <div style={{ background: 'rgba(255,255,255,.02)', borderRadius: 14, padding: '10px 12px', border: `1px solid ${C.border}` }}>
          <SectionLabel 
            color={ec.color} mini style={{ marginBottom: 8 }}
            active={targetSection === 'narrow'}
            onClick={() => setTargetSection(targetSection === 'narrow' ? null : 'narrow')}
          >узкий</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 4 }}>
            <WheelField label="SPH" value={data.n_sph} onChange={v => set('n_sph', v)} step={0.25} mini />
            <WheelField label="CYL" value={data.n_cyl} onChange={v => set('n_cyl', v)} step={0.25} mini />
            <DField label="AX" value={data.n_ax} onChange={v => set('n_ax', v)} type="number" unit="°" mini />
          </div>
        </div>

        {/* ШИРОКИЙ */}
        <div style={{ background: 'rgba(255,255,255,.02)', borderRadius: 14, padding: '10px 12px', border: `1px solid ${C.border}` }}>
          <SectionLabel 
            color={ec.color} mini style={{ marginBottom: 8 }}
            active={targetSection === 'cyclo'}
            onClick={() => setTargetSection(targetSection === 'cyclo' ? null : 'cyclo')}
          >широкий</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 4 }}>
            <WheelField label="SPH" value={data.c_sph} onChange={v => set('c_sph', v)} step={0.25} mini />
            <WheelField label="CYL" value={data.c_cyl} onChange={v => set('c_cyl', v)} step={0.25} mini />
            <DField label="AX" value={data.c_ax} onChange={v => set('c_ax', v)} type="number" unit="°" mini />
          </div>
        </div>
      </div>

      {/* КЕРАТОМЕТРИЯ */}
      <div style={{ background: 'rgba(255,255,255,.03)', padding: 12, borderRadius: 16, border: `1px solid ${C.border}` }}>
        <SectionLabel 
          color={ec.color} style={{ marginBottom: 10 }}
          active={targetSection === 'keratometry'}
          onClick={() => setTargetSection(targetSection === 'keratometry' ? null : 'keratometry')}
        >КЕРАТОМЕТРИЯ</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          <DField label="K1" value={data.k1} onChange={v => set('k1', v)} type="number" unit="D" step=".01" mini />
          <DField label="K2" value={data.k2} onChange={v => set('k2', v)} type="number" unit="D" step=".01" mini />
          <DField label="KM (MEAN)" value={data.kavg} onChange={v => set('kavg', v)} type="number" unit="D" step=".01" mini />
          <DField label="KER CYL" value={data.kercyl} onChange={v => set('kercyl', v)} type="number" unit="D" step=".01" mini />
          <DField label="KER AX" value={data.kerax} onChange={v => set('kerax', v)} type="number" unit="°" mini />
        </div>
      </div>

      {/* PENTACAM */}
      <div style={{ background: 'rgba(255,255,255,.03)', padding: 12, borderRadius: 16, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
          <SectionLabel 
            color={ec.color} style={{ flex: 1, marginBottom: 0 }}
            active={targetSection === 'pentacam'}
            onClick={() => setTargetSection(targetSection === 'pentacam' ? null : 'pentacam')}
          >PENTACAM</SectionLabel>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: 2, flexShrink: 0 }}>
            {(['Total', 'Ant', 'Post'] as const).map(t => (
              <button
                key={t}
                onClick={() => setPentaTab(t)}
                style={{
                  padding: '4px 12px', borderRadius: 8,
                  border: 'none',
                  background: pentaTab === t ? C.surface3 : 'transparent',
                  color: pentaTab === t ? C.text : C.muted,
                  fontFamily: F.sans, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  transition: 'all .2s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        
        {/* Отображаем данные активной вкладки Pentacam */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {pentaTab === 'Ant' && (
            <>
              <DField label="CYL" value={data.p_ant_c} onChange={v => set('p_ant_c', v)} type="number" unit="D" step=".01" />
              <DField label="AX" value={data.p_ant_a} onChange={v => set('p_ant_a', v)} type="number" unit="°" />
            </>
          )}
          {pentaTab === 'Post' && (
            <>
              <DField label="CYL" value={data.p_post_c} onChange={v => set('p_post_c', v)} type="number" unit="D" step=".01" />
              <DField label="AX" value={data.p_post_a} onChange={v => set('p_post_a', v)} type="number" unit="°" />
            </>
          )}
          {pentaTab === 'Total' && (
            <>
              <DField label="CYL" value={data.p_tot_c} onChange={v => set('p_tot_c', v)} type="number" unit="D" step=".01" />
              <DField label="AX" value={data.p_tot_a} onChange={v => set('p_tot_a', v)} type="number" unit="°" />
            </>
          )}
        </div>
      </div>

      {/* ДОП. ДАННЫЕ */}
      <div style={{ background: 'rgba(255,255,255,.03)', padding: 12, borderRadius: 16, border: `1px solid ${C.border}` }}>
        <SectionLabel color={ec.color} style={{ marginBottom: 10 }}>ДОП. ДАННЫЕ</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <DField label="CCT" value={data.cct} onChange={v => set('cct', v)} type="number" unit="мкм" />
          <DField label="WTW" value={data.wtw} onChange={v => set('wtw', v)} type="number" unit="мм" step=".1" />
        </div>
      </div>
    </div>
  );
}

// ── Секция биометрии (катаракта) ──────────────────────────────────────────────

function BiometryEye({ eye }: { eye: 'od' | 'os' }) {
  const { draft, setBioField } = useSessionStore();
  const ec = eyeColors(eye);
  const bioKey = `bio_${eye}` as 'bio_od' | 'bio_os';
  const data = draft?.[bioKey] ?? newBiometryData();
  const set = (f: string, v: string) => setBioField(eye, f, v);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel color={ec.color}>Биометрия {eye.toUpperCase()}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <DField label="AL" value={data.al} onChange={v => set('al', v)} type="number" unit="мм" step=".01" accentColor={ec.color} />
        <DField label="ACD" value={data.acd} onChange={v => set('acd', v)} type="number" unit="мм" step=".01" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <DField label="K1" value={data.k1} onChange={v => set('k1', v)} type="number" unit="D" step=".01" />
        <DField label="K2" value={data.k2} onChange={v => set('k2', v)} type="number" unit="D" step=".01" />
        <DField label="Ось K °" value={data.k1_ax} onChange={v => set('k1_ax', v)} type="number" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <DField label="LT*" value={data.lt} onChange={v => set('lt', v)} type="number" unit="мм" step=".01" />
        <DField label="WTW*" value={data.wtw} onChange={v => set('wtw', v)} type="number" unit="мм" step=".1" />
      </div>
    </div>
  );
}

// ── BioTab ────────────────────────────────────────────────────────────────────

export function BioTab() {
  const { draft } = useSessionStore();
  const { activeEye, setActiveEye } = useUIStore();

  if (!draft) return null;
  const isCat = draft.type === 'cataract';

  if (isCat) {
    // Для одного глаза — фиксируем без переключателя
    const fixedEye = draft.eye === 'OS' ? 'os' : 'od';
    const showToggle = draft.eye === 'OU';
    const eye = showToggle ? activeEye : fixedEye;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {showToggle && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <EyeToggle value={activeEye} onChange={setActiveEye} />
          </div>
        )}
        <BiometryEye eye={eye} />
      </div>
    );
  }

  // Рефракция: оба глаза с переключателем
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EyeToggle value={activeEye} onChange={setActiveEye} />
      </div>
      <RefractionEye eye={activeEye} />
    </div>
  );
}
