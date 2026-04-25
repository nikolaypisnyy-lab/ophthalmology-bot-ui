import { useMemo, useState, useEffect } from 'react';
import { C, F, R, typeColors, eyeColors } from '../constants/design';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { Chip } from '../ui/Chip';
import { SearchBar } from '../ui/SearchBar';
import { apiGet } from '../api/client';
import { useClinicStore } from '../store/useClinicStore';
import type { PatientSummary } from '../types/patient';

// ── Стат-карточка ─────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string | null }) => (
  <div style={{
    background: C.surface2, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: '8px 10px', flex: 1,
    display: 'flex', flexDirection: 'column', gap: 2,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
  }}>
    <span style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 800, color: C.muted, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
    {sub && <span style={{ fontFamily: F.sans, fontSize: 7, color: C.muted, fontWeight: 700 }}>{sub}</span>}
  </div>
);

// ── Карточка результата ───────────────────────────────────────────────────────

function VisionShift({ eye, pre, post, color, type, isWF }: { eye: string; pre: any; post: any; color: string; type: 'cataract' | 'refraction', isWF?: boolean }) {
  const vaPre = parseFloat(pre.va || '0') || 0;
  const vaPost = parseFloat(post.va || '0') || 0;
  const isGain = vaPost > vaPre;
  const isRef = type === 'refraction';

  const fmt = (v: any) => {
    const n = parseFloat(String(v));
    if (isNaN(n)) return '0.00';
    return (n > 0 ? '+' : '') + n.toFixed(2);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 900, color }}>{eye}</span>
        <div style={{ flex: 1, height: 1, background: `${color}30` }} />
        {isRef && isWF && <span style={{ fontSize: 6, fontWeight: 900, color: '#fff', background: color, padding: '0 2px', borderRadius: 2 }}>WF</span>}
        {isRef && <span style={{ fontSize: 6, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>{post.tech === 'fs' ? 'Femto' : 'Mech'}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted3, textDecoration: 'line-through', opacity: 0.7 }}>{pre.va || '—'}</span>
          <span style={{ fontSize: 8, color: C.muted3 }}>→</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 900, color: vaPost >= 1.0 ? C.green : C.text }}>{post.va || '—'}</span>
            {isGain && <span style={{ fontSize: 8, color: C.green, fontWeight: 900 }}>↑</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, opacity: 0.6 }}>
          <span style={{ fontFamily: F.mono, fontSize: 7, color: C.muted2 }}>{fmt(post.sph)} {fmt(post.cyl)} x{post.ax || '0'}°</span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ patient, onOpen }: { patient: PatientSummary; onOpen: () => void }) {
  const tc = typeColors(patient.type);
  const p = patient as any;
  const sex = (p.sex || p.gender || patient.sex || '').toUpperCase();
  const isFemale = sex.startsWith('Ж') || sex.startsWith('F');

  const periods = p.periods || {};
  const latestKey = Object.keys(periods).pop();
  const latest = latestKey ? periods[latestKey] : null;

  const getRes = (eye: 'od' | 'os') => {
    const eyeData = p[eye] || {};
    const strategy = eye === 'od' ? p.astigStrategyOD : p.astigStrategyOS;
    return {
      sph: latest?.[eye]?.sph ?? p[`postSph${eye.toUpperCase()}`] ?? '0.00',
      cyl: latest?.[eye]?.cyl ?? p[`postCyl${eye.toUpperCase()}`] ?? '0.00',
      ax: latest?.[eye]?.ax ?? p[`postAx${eye.toUpperCase()}`] ?? '0',
      va: latest?.[eye]?.va ?? p[`postVa${eye.toUpperCase()}`] ?? '—',
      isWF: String(strategy).toLowerCase() === 'wavefront' || 
            String(eyeData.astigStrategy).toLowerCase() === 'wavefront' || 
            String(p.astigStrategy).toLowerCase() === 'wavefront' || 
            !!p.isWavefront,
      tech: p.flapTech || 'fs'
    };
  };

  const resOD = getRes('od');
  const resOS = getRes('os');
  const preOD = { va: p.od?.va || p.preVaOD || '—' };
  const preOS = { va: p.os?.va || p.preVaOS || '—' };

  return (
    <div
      onClick={onOpen}
      style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '10px 14px 10px 18px',
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
        width: '100%', position: 'relative', overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: isFemale ? '#f472b6' : C.od }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 800, color: C.primary }}>{patient.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: F.mono, fontSize: 7, color: C.tertiary, opacity: 0.6 }}>{latestKey || 'RESULT'}</span>
          <span style={{ fontSize: 7, fontWeight: 900, color: tc.color, background: `${tc.color}15`, padding: '2px 6px', borderRadius: 4 }}>{patient.type === 'cataract' ? 'IOL' : 'LASIK'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <VisionShift eye="OD" pre={preOD} post={resOD} color={C.od} type={patient.type} isWF={resOD.isWF} />
        <div style={{ width: 1, height: 20, background: C.border, opacity: 0.2 }} />
        <VisionShift eye="OS" pre={preOS} post={resOS} color={C.os} type={patient.type} isWF={resOS.isWF} />
      </div>

      {patient.type === 'cataract' && p.iolResult && (
        <div style={{ 
          marginTop: 6, padding: '6px 10px', background: `${C.surface}80`, borderRadius: 10, 
          border: `1px solid ${C.border}40`, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: `${C.cat}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.cat} strokeWidth="2.5">
              <path d="M12 2v20M2 12h20" />
            </svg>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.text, opacity: 0.9, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.iolResult.lens || 'IOL'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {(patient.eye === 'OD' || patient.eye === 'OU') && p.iolResult.od?.selectedPower !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 6, fontWeight: 900, color: C.od }}>OD</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                  {typeof p.iolResult.od.selectedPower === 'number' ? p.iolResult.od.selectedPower.toFixed(2) : parseFloat(String(p.iolResult.od.selectedPower)).toFixed(2)}
                  {p.toricResults?.od?.best_model && <span style={{ color: C.indigo, marginLeft: 2, fontSize: 8 }}>{p.toricResults.od.best_model}</span>}
                </span>
              </div>
            )}
            {(patient.eye === 'OS' || patient.eye === 'OU') && p.iolResult.os?.selectedPower !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 6, fontWeight: 900, color: C.os }}>OS</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: C.text, fontFamily: F.mono }}>
                  {typeof p.iolResult.os.selectedPower === 'number' ? p.iolResult.os.selectedPower.toFixed(2) : parseFloat(String(p.iolResult.os.selectedPower)).toFixed(2)}
                  {p.toricResults?.os?.best_model && <span style={{ color: C.indigo, marginLeft: 2, fontSize: 8 }}>{p.toricResults.os.best_model}</span>}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Страница ──────────────────────────────────────────────────────────────────

export function ResultsPage() {
  const { patients } = usePatientStore();
  const { openPatient } = useUIStore();
  const { activeRefNomo, setRefNomo, activeRefNomoCyl, setRefNomoCyl } = useClinicStore();
  const [filter, setFilter] = useState<'all' | 'refraction' | 'cataract'>('all');
  const [search, setSearch] = useState('');
  const [nomo, setNomo] = useState<any>(null);

  // Fetch Nomogram stats
  const fetchNomo = async () => {
    try {
      const data = await apiGet<any>('/nomogram');
      if (data && data.count > 0) setNomo(data);
    } catch (e) { }
  };

  useEffect(() => {
    fetchNomo();
  }, []);

  const done = useMemo(() => patients.filter(p => p.status === 'done'), [patients]);

  const visible = useMemo(() => {
    return done.filter(p => {
      if (filter !== 'all' && p.type !== filter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [done, filter, search]);

  // Статистика
  const stats = useMemo(() => {
    const filtered = filter === 'all' ? done : done.filter(p => p.type === filter);
    const catDone = filtered.filter(p => p.type === 'cataract' && (p as any).postSphOD !== undefined);
    const refDone = filtered.filter(p => p.type === 'refraction' && (p as any).postSphOD !== undefined);

    const getSE = (p: any) => {
      const s = parseFloat(String(p.postSphOD || 0));
      const c = parseFloat(String(p.postCylOD || 0));
      return s + c / 2;
    };

    const catHit = catDone.filter(p => Math.abs(getSE(p) - parseFloat(String(p.targetRefr ?? '0'))) <= 0.5).length;
    const refHit = refDone.filter(p => Math.abs(getSE(p)) <= 0.25).length;

    if (filter === 'cataract') {
      return [
        { label: 'Всего операций', val: filtered.length, color: C.text, sub: null },
        { label: 'Успех ±0.5D', val: catDone.length ? `${Math.round(catHit / catDone.length * 100)}%` : '—', color: C.green, sub: `${catHit}/${catDone.length}` },
      ];
    }
    if (filter === 'refraction') {
      return [
        { label: 'Всего случаев', val: filtered.length, color: C.text, sub: null },
        { label: 'Успех ±0.25D', val: refDone.length ? `${Math.round(refHit / refDone.length * 100)}%` : '—', color: C.ref, sub: `${refHit}/${refDone.length}` },
      ];
    }
    return [
      { label: 'Всего случаев', val: done.length, color: C.text, sub: null },
      { label: 'Успех ИОЛ', val: catDone.length ? `${Math.round(catHit / catDone.length * 100)}%` : '—', color: C.green, sub: `${catHit}/${catDone.length}` },
      { label: 'Успех ЛКЗ', val: refDone.length ? `${Math.round(refHit / refDone.length * 100)}%` : '—', color: C.ref, sub: `${refHit}/${refDone.length}` },
    ];
  }, [done, filter]);

  // UI Recommendation logic
  const renderNomoRow = (label: string, field: 'sph' | 'cyl') => {
    const proposed = field === 'sph' ? nomo.proposed_offset_sph : nomo.proposed_offset_cyl;
    const avgErr = field === 'sph' ? nomo.avg_sph_error : nomo.avg_cyl_error;
    const active = field === 'sph' ? activeRefNomo : activeRefNomoCyl;
    const setter = field === 'sph' ? setRefNomo : setRefNomoCyl;

    if (proposed === 0 && avgErr === 0) return null;

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: field === 'cyl' ? 4 : 0 }}>
        <div style={{ fontFamily: F.sans, fontSize: 11, color: C.text, fontWeight: 500 }}>
          {label}: <span style={{
            color: parseFloat(String(avgErr)) > 0 ? '#f87171' : C.green,
            fontWeight: 700
          }}>
            {parseFloat(String(avgErr)) > 0 ? '+' : ''}{avgErr}D
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: F.sans, fontSize: 7, color: C.muted, textTransform: 'uppercase', lineHeight: 1 }}>Поправка</div>
            <div style={{ fontFamily: F.mono, fontSize: 13, color: C.green, fontWeight: 800, lineHeight: 1.1 }}>
              {proposed > 0 ? '+' : ''}{proposed} D
            </div>
          </div>
          <button
            onClick={() => {
              if (active === proposed) setter(null);
              else setter(proposed);
            }}
            style={{
              background: active === proposed ? C.green : C.accent,
              border: 'none', borderRadius: 8, padding: '4px 10px',
              color: '#fff', fontFamily: F.sans, fontSize: 10, fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s', width: 80, height: 26
            }}
          >
            {active === proposed ? 'АКТИВНО' : 'ПРИМЕНИТЬ'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Шапка со статистикой и фильтрами */}
      <div style={{
        padding: '10px 14px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length},1fr)`, gap: 6 }}>
          {stats.map(s => (
            <StatCard key={s.label} label={s.label} value={s.val} color={s.color} sub={s.sub} />
          ))}
        </div>

        {/* Nomogram Recommendation Card */}
        {nomo && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(99,102,241,0.08) 0%,rgba(168,85,247,0.08) 100%)',
            border: `1px solid rgba(168,85,247,0.15)`,
            borderRadius: 12, padding: '8px 12px',
            display: 'flex', flexDirection: 'column', gap: 4
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>🧠</span>
                <span style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 800, color: C.accent, letterSpacing: '.05em' }}>AUTO-NOMOGRAM</span>
              </div>
              <span style={{ fontFamily: F.sans, fontSize: 8, color: C.muted, fontWeight: 600 }}>{nomo.count} ГЛАЗ ПРОАНАЛИЗИРОВАНО</span>
            </div>

            {renderNomoRow('Сфера (SE)', 'sph')}
            {renderNomoRow('Цилиндр', 'cyl')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          <Chip label="Все" active={filter === 'all'} color={C.accent} onClick={() => setFilter('all')} />
          <Chip label="Рефракция" active={filter === 'refraction'} color={C.ref} onClick={() => setFilter('refraction')} />
          <Chip label="Катаракта" active={filter === 'cataract'} color={C.cat} onClick={() => setFilter('cataract')} />
        </div>

        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Список с абсолютным позиционированием */}
      <div style={{ flex: 1, position: 'relative', minHeight: 100 }}>
        <div style={{
          position: 'absolute', inset: 0,
          overflowY: 'scroll', // Explicit scroll
          padding: '12px 16px 120px',
          display: 'block', // Fail-safe block display
          WebkitOverflowScrolling: 'touch'
        }}>
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
              {search ? 'Ничего не найдено' : 'Нет завершённых операций'}
            </div>
          )}
          {visible.map(p => (
            <div key={p.id} style={{ display: 'block', width: '100%', marginBottom: 12 }}>
              <ResultCard
                patient={p}
                onOpen={() => openPatient(String(p.id), 'result')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
