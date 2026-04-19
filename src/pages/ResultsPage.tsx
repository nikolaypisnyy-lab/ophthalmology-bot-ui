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

function StatCard({ label, value, color, sub }: {
  label: string; value: string | number; color: string; sub?: string | null;
}) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, padding: '12px' }}>
      <div style={{ fontFamily: F.sans, fontSize: 9, fontWeight: 600, color: C.muted, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 700, color }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: F.sans, fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Карточка результата ───────────────────────────────────────────────────────

function EyeResultRow({ label, sph, cyl, ax, target, color }: {
  label: string; sph?: any; cyl?: any; ax?: any; target: number; color: string;
}) {
  if (sph === undefined || sph === null) return null;
  const numSph = parseFloat(String(sph || 0));
  const numCyl = parseFloat(String(cyl || 0));
  const numAx = ax ? parseFloat(String(ax)) : null;
  
  const se = numSph + numCyl / 2;
  const hit = Math.abs(se - target) <= 0.5;
  const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);
  return (
    <div style={{
      background: C.surface2, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 800, color }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.text }}>
          {fmt(numSph)}{numCyl !== 0 ? ` / ${fmt(numCyl)}` : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, fontWeight: 600 }}>
            {numAx ? `Ax: ${numAx}°` : ''}
          </span>
          <div style={{ color: C.muted, fontSize: 8, fontWeight: 700, fontFamily: F.sans, flexShrink: 0 }}>
            SE: <span style={{ color: hit ? C.green : C.text }}>{fmt(se)}</span>
          </div>
        </div>
      </div>
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
      <div style={{ display: 'flex', gap: 8 }}>
        {showOD && (
          <EyeResultRow label="OD" sph={p.postSphOD} cyl={p.postCylOD} ax={p.postAxOD} target={target} color={C.od} />
        )}
        {showOS && (
          <EyeResultRow label="OS" sph={p.postSphOS} cyl={p.postCylOS} ax={p.postAxOS} target={target} color={C.os} />
        )}
      </div>
      {showFallback && (
        <EyeResultRow label={patient.eye ?? ''} sph={patient.postSph} cyl={patient.postCyl} ax={p.postAxOD || p.postAxOS} target={target} color={C.accent} />
      )}
    </div>
  );
}

// ── Страница ──────────────────────────────────────────────────────────────────

export function ResultsPage() {
  const { patients } = usePatientStore();
  const { openPatient } = useUIStore();
  const { activeRefNomo, setRefNomo } = useClinicStore();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Шапка со статистикой и фильтрами */}
      <div style={{ 
        padding: '14px 16px 14px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 12,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length},1fr)`, gap: 8 }}>
          {stats.map(s => (
            <StatCard key={s.label} label={s.label} value={s.val} color={s.color} sub={s.sub} />
          ))}
        </div>

        {/* Nomogram Recommendation Card */}
        {nomo && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(99,102,241,0.1) 0%,rgba(168,85,247,0.1) 100%)',
            border: `1px solid rgba(168,85,247,0.2)`,
            borderRadius: 14, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 6
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>🧠</span>
                <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: '.05em' }}>AUTO-NOMOGRAM (BETA)</span>
              </div>
              <span style={{ fontFamily: F.sans, fontSize: 9, color: C.muted }}>{nomo.count} ГЛАЗ ПРОАНАЛИЗИРОВАНО</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: F.sans, fontSize: 12, color: C.text, fontWeight: 500 }}>
                Среднее SE: <span style={{ 
                  color: parseFloat(nomo.avg_sph_error) > 0 ? '#f87171' : C.green, 
                  fontWeight: 700 
                }}>
                  {parseFloat(nomo.avg_sph_error) > 0 ? '+' : ''}{nomo.avg_sph_error}D
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: F.sans, fontSize: 8, color: C.muted, textTransform: 'uppercase' }}>Рекомендация</div>
                  <div style={{ fontFamily: F.mono, fontSize: 16, color: C.green, fontWeight: 800 }}>
                    {nomo.proposed_offset_sph > 0 ? '+' : ''}{nomo.proposed_offset_sph} D
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (activeRefNomo === nomo.proposed_offset_sph) setRefNomo(null);
                    else setRefNomo(nomo.proposed_offset_sph);
                  }}
                  style={{
                    background: activeRefNomo === nomo.proposed_offset_sph ? C.green : C.accent,
                    border: 'none', borderRadius: 10, padding: '8px 12px',
                    color: '#fff', fontFamily: F.sans, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s'
                  }}
                >
                  {activeRefNomo === nomo.proposed_offset_sph ? 'АКТИВНО ✓' : 'ПРИМЕНИТЬ'}
                </button>
              </div>
            </div>
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
