import { useMemo, useState } from 'react';
import { C, F, typeColors } from '../constants/design';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { Chip } from '../ui/Chip';
import { SearchBar } from '../ui/SearchBar';
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
  label: string; sph?: number; cyl?: number; ax?: number; target: number; color: string;
}) {
  if (sph === undefined) return null;
  const se = sph + (cyl ?? 0) / 2;
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
          {fmt(sph)}{cyl && cyl !== 0 ? ` / ${fmt(cyl)}` : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, fontWeight: 600 }}>
            {ax ? `Ax: ${ax}°` : ''}
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
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
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
  const [filter, setFilter] = useState<'all' | 'refraction' | 'cataract'>('all');
  const [search, setSearch] = useState('');

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
    const catDone = filtered.filter(p => p.type === 'cataract' && p.postSph !== undefined);
    const refDone = filtered.filter(p => p.type === 'refraction' && p.postSph !== undefined);
    const catSE = (p: PatientSummary) => (p.postSph ?? 0) + (p.postCyl ?? 0) / 2;
    const catHit = catDone.filter(p => Math.abs(catSE(p) - parseFloat(String(p.targetRefr ?? '0'))) <= 0.5).length;
    const refHit = refDone.filter(p => Math.abs(catSE(p)) <= 0.25).length;

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Шапка со статистикой и фильтрами */}
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length},1fr)`, gap: 8 }}>
          {stats.map(s => (
            <StatCard key={s.label} label={s.label} value={s.val} color={s.color} sub={s.sub} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          <Chip label="Все" active={filter === 'all'} color={C.accent} onClick={() => setFilter('all')} />
          <Chip label="Рефракция" active={filter === 'refraction'} color={C.ref} onClick={() => setFilter('refraction')} />
          <Chip label="Катаракта" active={filter === 'cataract'} color={C.cat} onClick={() => setFilter('cataract')} />
        </div>

        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Список */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
            {search ? 'Ничего не найдено' : 'Нет завершённых операций'}
          </div>
        )}
        {visible.map(p => (
          <ResultCard
            key={p.id}
            patient={p}
            onOpen={() => openPatient(String(p.id), 'result')}
          />
        ))}
      </div>
    </div>
  );
}
