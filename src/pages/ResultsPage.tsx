import { useMemo, useState, useEffect } from 'react';
import { C, F, R, typeColors, eyeColors } from '../constants/design';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { Chip } from '../ui/Chip';
import { SearchBar } from '../ui/SearchBar';
import { apiGet } from '../api/client';
import { useClinicStore } from '../store/useClinicStore';
import { T } from '../constants/translations';
import { useTelegram } from '../hooks/useTelegram';
import type { PatientSummary } from '../types/patient';

// ── Стат-карточка ─────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string | null }) => (
  <div style={{
    background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surface2} 100%)`, 
    border: `1px solid ${C.border}40`,
    borderRadius: 14, padding: '10px 12px', flex: 1,
    display: 'flex', flexDirection: 'column', gap: 4,
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    minWidth: 0
  }}>
    <span style={{ fontFamily: F.sans, fontSize: 7, fontWeight: 900, color: C.muted2, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</span>
    {sub && <span style={{ fontFamily: F.mono, fontSize: 7, color: C.muted, fontWeight: 800 }}>{sub}</span>}
  </div>
);

// ── Карточка результата ───────────────────────────────────────────────────────

function VisionShift({ 
  eye, pre, post, color, type, isWF 
}: { 
  eye: string; pre: any; post: any; color: string; type: 'cataract' | 'refraction', isWF?: boolean 
}) {
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
  const eyeUpper = (patient.eye || 'OU').toUpperCase();

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
        {(eyeUpper === 'OD' || eyeUpper === 'OU') && (
          <VisionShift 
            eye="OD" pre={preOD} post={resOD} color={C.od} 
            type={patient.type} isWF={resOD.isWF} 
          />
        )}
        
        {eyeUpper === 'OU' && <div style={{ width: 1, height: 20, background: C.border, opacity: 0.2 }} />}
        
        {(eyeUpper === 'OS' || eyeUpper === 'OU') && (
          <VisionShift 
            eye="OS" pre={preOS} post={resOS} color={C.os} 
            type={patient.type} isWF={resOS.isWF} 
          />
        )}
      </div>

      {patient.type === 'cataract' && p.iolResult && (
        <div style={{ 
          marginTop: 8, padding: '8px 12px', 
          background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surface2} 100%)`, 
          borderRadius: 12, 
          border: `1px solid ${C.border}60`, 
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ 
            width: 28, height: 28, borderRadius: 10, 
            background: C.surface3, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            border: `1px solid ${C.border2}`,
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.cat} strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="6" />
              <path d="M12 6c3.314 0 6 2.686 6 6" />
              <path d="M12 18c-3.314 0-6-2.686-6-6" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.text, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.iolResult.lens || 'IOL'}
            </span>
            {p.toricResults && (p.toricResults.od?.best_model || p.toricResults.os?.best_model) && (
              <span style={{ fontSize: 7, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Toric: {p.toricResults.od?.best_model || p.toricResults.os?.best_model}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            {(() => {
              const eyes: ('od' | 'os')[] = (patient.eye === 'OU') ? ['od', 'os'] : [patient.eye?.toLowerCase() as any || 'od'];
              return eyes.map(eye => {
                const eyeData = p.iolResult?.[eye];
                const pwr = eyeData?.selectedPower ?? (p.iolResult as any)?.power;
                if (pwr === undefined || pwr === null || pwr === '—') return null;
                const fmtPwr = typeof pwr === 'number' ? pwr.toFixed(2) : pwr;
                return (
                  <div key={eye} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 6, fontWeight: 900, color: eye === 'od' ? C.od : C.os, textTransform: 'uppercase' }}>{eye}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 900, color: C.primary, lineHeight: 1.1 }}>
                      {fmtPwr}D
                    </span>
                  </div>
                );
              });
            })()}
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
  const { activeRefNomo, setRefNomo, activeRefNomoCyl, setRefNomoCyl, language } = useClinicStore();
  const { haptic } = useTelegram();
  const t = T(language);
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
    const { language } = useClinicStore.getState();
    const t = T(language);
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
        { label: t.totalCases, val: filtered.length, color: C.text, sub: null },
        { label: 'Success ±0.5D', val: catDone.length ? `${Math.round(catHit / catDone.length * 100)}%` : '—', color: C.green, sub: `${catHit}/${catDone.length}` },
      ];
    }
    if (filter === 'refraction') {
      return [
        { label: t.totalCases, val: filtered.length, color: C.text, sub: null },
        { label: 'Success ±0.25D', val: refDone.length ? `${Math.round(refHit / refDone.length * 100)}%` : '—', color: C.ref, sub: `${refHit}/${refDone.length}` },
      ];
    }
    return [
      { label: t.totalCases, val: done.length, color: C.text, sub: null },
      { label: t.iolSuccess, val: catDone.length ? `${Math.round(catHit / catDone.length * 100)}%` : '—', color: C.green, sub: `${catHit}/${catDone.length}` },
      { label: t.lasikSuccess, val: refDone.length ? `${Math.round(refHit / refDone.length * 100)}%` : '—', color: C.ref, sub: `${refHit}/${refDone.length}` },
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
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '10px 12px', background: `${C.surface}40`, borderRadius: 14,
        border: `1px solid ${C.border}30`, marginBottom: field === 'sph' ? 6 : 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: F.sans, fontSize: 8, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </span>
          <span style={{ 
            fontFamily: F.mono, fontSize: 16, fontWeight: 900, 
            color: parseFloat(String(avgErr)) > 0 ? '#f87171' : C.green 
          }}>
            {parseFloat(String(avgErr)) > 0 ? '+' : ''}{avgErr}D
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: F.sans, fontSize: 7, fontWeight: 900, color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t.correction}</div>
            <div style={{ fontFamily: F.mono, fontSize: 14, color: C.text, fontWeight: 800 }}>
              {proposed > 0 ? '+' : ''}{proposed.toFixed(2)}D
            </div>
          </div>
          
          <button
            onClick={() => {
              haptic.light();
              if (active === proposed) setter(null);
              else setter(proposed);
            }}
            style={{
              background: active === proposed ? `linear-gradient(135deg, ${C.green}, #059669)` : `linear-gradient(135deg, ${C.accent}, ${C.indigo})`,
              border: 'none', borderRadius: 10, padding: '6px 12px',
              color: '#fff', fontFamily: F.sans, fontSize: 9, fontWeight: 900,
              cursor: 'pointer', 
              boxShadow: active === proposed ? `0 4px 12px ${C.green}40` : `0 4px 12px ${C.indigo}40`,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
              minWidth: 70, height: 30,
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}
          >
            {active === proposed ? t.active : t.apply}
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
            background: `linear-gradient(135deg, ${C.indigo}25 0%, ${C.bg} 40%, ${C.accent}15 100%)`,
            border: `1px solid ${C.indigo}40`,
            borderRadius: 20, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 6,
            boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <button 
              onClick={() => { haptic.selection(); setNomo(null); }}
              style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: C.muted2, fontSize: 18, cursor: 'pointer', zIndex: 10, padding: 4 }}
            >
              ×
            </button>
            
            {/* Mesh-like subtle overlay */}
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 20% 20%, ${C.indigo}15 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${C.accent}10 0%, transparent 50%)`, pointerEvents: 'none' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 8, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12 }}>🧠</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 900, color: C.text, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t.nomogramTitle}</span>
                  <span style={{ fontFamily: F.sans, fontSize: 6.5, color: C.muted2, fontWeight: 800, textTransform: 'uppercase' }}>{t.proAnalytics}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', marginRight: 24 }}>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.accent, fontWeight: 900 }}>{nomo.count}</span>
                <span style={{ fontFamily: F.sans, fontSize: 6.5, color: C.muted2, fontWeight: 800, textTransform: 'uppercase', marginLeft: 4 }}>{t.eyesAnalyzed}</span>
              </div>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {renderNomoRow('Sphere (SE)', 'sph')}
              {renderNomoRow('Cylinder', 'cyl')}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Chip label={t.all} active={filter === 'all'} color={C.accent} onClick={() => setFilter('all')} />
          <Chip label={t.refraction} active={filter === 'refraction'} color={C.ref} onClick={() => setFilter('refraction')} />
          <Chip label={t.cataract} active={filter === 'cataract'} color={C.cat} onClick={() => setFilter('cataract')} />
        </div>

        <SearchBar value={search} onChange={setSearch} placeholder={t.search} />
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
              {search ? t.noResults : t.noCasesRecorded}
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
