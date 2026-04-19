import { useMemo, useState, useEffect } from 'react';
import { C, F, typeColors } from '../constants/design';
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

function EyeResultRow({ label, sph, cyl, ax, target, color, flapDiam, capOrFlap }: {
  label: string; sph?: any; cyl?: any; ax?: any; target: number; color: string; flapDiam?: string; capOrFlap?: string;
}) {
  if (sph === undefined || sph === null) return null;
  const numSph = parseFloat(String(sph || 0));
  const numCyl = parseFloat(String(cyl || 0));
  const numAx = (ax !== undefined && ax !== null && ax !== '') ? parseFloat(String(ax)) : null;
  
  const se = numSph + numCyl / 2;
  const hit = Math.abs(se - target) <= 0.5;
  const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);
  return (
    <div style={{
      background: C.surface2, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '6px 10px',
      display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0
    }}>
      {/* Верхний ярус: Глаз и SE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 900, color }}>{label}</span>
        <div style={{ color: C.muted, fontSize: 8, fontWeight: 800, fontFamily: F.sans }}>
            SE: <span style={{ color: hit ? C.green : C.text }}>{fmt(se)}</span>
        </div>
      </div>

      {/* Средний ярус: Основная рефракция (шрифт чуть меньше чтобы влезло) */}
      <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
        {fmt(numSph)}{numCyl !== 0 ? ` / ${fmt(numCyl)}` : ''}{numAx !== null ? ` ×${numAx}°` : ''}
      </div>

      {/* Нижний ярус: Параметры флэпа / Метод */}
      {(flapDiam || capOrFlap) && (
        <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 2 }}>
          {capOrFlap === 'ФРК' ? (
            <span style={{ fontFamily: F.sans, fontSize: 9, color: C.accent, fontWeight: 900, letterSpacing: '0.05em' }}>
              МЕТОД: ФРК
            </span>
          ) : (
            <>
              {capOrFlap && (
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, fontWeight: 600 }}>
                  <span style={{ fontSize: 7, opacity: 0.7, fontWeight: 800 }}>FLAP:</span> {capOrFlap}
                </span>
              )}
              {flapDiam && (
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, fontWeight: 600 }}>
                  <span style={{ fontSize: 7, opacity: 0.7, fontWeight: 800 }}>Ø</span> {flapDiam}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ patient, onOpen }: { patient: PatientSummary; onOpen: () => void }) {
  const tc = typeColors(patient.type);
  const p = patient as any;

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const M = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    return `${+day} ${M[+m - 1]} ${y}`;
  };

  const target = patient.type === 'cataract' ? parseFloat(String(patient.targetRefr ?? '0')) : 0;

  // Показываем глаза по наличию данных
  const showOD = p.postSphOD !== undefined;
  const showOS = p.postSphOS !== undefined;
  // Fallback: если нет per-eye данных, показываем общий postSph
  const showFallback = !showOD && !showOS && patient.postSph !== undefined;

  return (
    <div
      onClick={onOpen}
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '12px 14px',
        cursor: 'pointer', display: 'block', // Change to block
        marginBottom: 10, // Use margin instead of gap
        minHeight: 100, // Explicit height
        width: '100%',
        position: 'relative',
        flexShrink: 0
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {patient.name}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, marginTop: 1 }}>
            {fmtDate(patient.date)}
          </div>
        </div>
        <span style={{ background: tc.bg, color: tc.color, fontFamily: F.sans, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
          {patient.type === 'cataract' ? 'Катаракта' : 'Рефракция'}
        </span>
      </div>

      {/* Результаты по глазам */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {showOD && (
            <EyeResultRow label="OD" sph={p.postSphOD} cyl={p.postCylOD} ax={p.postAxOD} target={target} color={C.od} flapDiam={p.flapDiam} capOrFlap={p.capOrFlap} />
          )}
          {showOS && (
            <EyeResultRow label="OS" sph={p.postSphOS} cyl={p.postCylOS} ax={p.postAxOS} target={target} color={C.os} flapDiam={p.flapDiam} capOrFlap={p.capOrFlap} />
          )}
        </div>
        
        {showFallback && (
          <EyeResultRow label={patient.eye ?? ''} sph={patient.postSph} cyl={patient.postCyl} ax={p.postAxOD || p.postAxOS} target={target} color={C.accent} flapDiam={p.flapDiam} capOrFlap={p.capOrFlap} />
        )}

      </div>
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
    } catch(e) {}
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
