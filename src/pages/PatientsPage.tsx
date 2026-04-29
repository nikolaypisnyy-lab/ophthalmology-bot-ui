import React, { useEffect, useMemo } from 'react';
import { C, F, R, typeColors, eyeColors } from '../constants/design';
import { useUIStore } from '../store/useUIStore';
import { useClinicStore } from '../store/useClinicStore';
import { usePatientStore } from '../store/usePatientStore';
import { useTelegram } from '../hooks/useTelegram';
import { SearchBar } from '../ui/SearchBar';
import { Chip } from '../ui/Chip';
import { T } from '../constants/translations';
import type { PatientSummary } from '../types/patient';

function PatientCard({
  patient,
  index,
  onOpen,
  onDelete,
}: {
  patient: PatientSummary;
  index: number;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { haptic } = useTelegram();
  const { language } = useClinicStore();
  const t = T(language);
  const tc = typeColors(patient.type);
  const ec = eyeColors((patient.eye?.toLowerCase() === 'os' ? 'os' : 'od'));
  
  const [showMenu, setShowMenu] = React.useState(false);
  const timerRef = React.useRef<any>(null);
  const isLongPress = React.useRef(false);

  const startPress = (e: React.PointerEvent) => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      haptic.impact('heavy');
      setShowMenu(true);
    }, 600);
  };

  const endPress = (e: React.PointerEvent) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isLongPress.current && !showMenu) {
      onOpen(String(patient.id));
    }
  };

  return (
    <div 
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ 
        position: 'relative', 
        borderRadius: R.lg, 
        background: C.card,
        border: `1px solid ${showMenu ? C.red : C.border}`,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        transition: 'all 0.2s',
        transform: showMenu ? 'scale(0.98)' : 'scale(1)',
        opacity: showMenu ? 0.8 : 1,
        animationDelay: `${index * 0.03}s`,
      }}
    >
      <div style={{
        width: 4, height: 26, borderRadius: 2, flexShrink: 0,
        background: (patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F')) ? '#f472b6' : 
                    (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M')) ? C.od : C.border,
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ 
            fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.text, 
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
          }}>{patient.name}</span>
          <span style={{
            fontFamily: F.mono, fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 4,
            background: (patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F')) ? '#f472b615' : 
                        (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M')) ? `${C.od}15` : C.surface,
            color: (patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F')) ? '#f472b6' : 
                   (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M')) ? C.od : C.muted2,
            border: `1px solid ${(patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F')) ? '#f472b630' : 
                        (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M')) ? `${C.od}30` : C.border}`,
            flexShrink: 0
          }}>{(patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F')) ? 'F' : 
              (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M')) ? 'M' : 'P'}</span>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ opacity: 0.6 }}>ID {patient.id}</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
          <span>{patient.age || '—'}{t.years}</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
          <span style={{ color: ec.color, fontWeight: 800 }}>{patient.eye}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <div style={{
          background: tc.bg, color: tc.color, fontFamily: F.mono, fontSize: 9, fontWeight: 700,
          padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', border: `1px solid ${tc.color}40`,
        }}>{patient.type === 'cataract' ? t.cataract : t.refraction}</div>
        {patient.status === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
             <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
             <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green, fontWeight: 700, opacity: 0.8 }}>{t.operated}</span>
          </div>
        )}
      </div>

      {showMenu && (
        <div 
          onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
          style={{ 
            position: 'absolute', inset: 0, zIndex: 100, 
            background: `${C.red}F0`, borderRadius: R.lg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); haptic.notification('success'); onDelete(String(patient.id)); }}
            style={{ 
              background: '#fff', color: C.red, border: 'none', borderRadius: 12, 
              padding: '8px 20px', fontFamily: F.sans, fontSize: 13, fontWeight: 800,
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer'
            }}
          >
            {t.delete.toUpperCase()}
          </button>
        </div>
      )}
    </div>
  );
}

export function PatientsPage() {
  const { patients, loading, fetchPatients, deletePatient } = usePatientStore();
  const { searchQuery, setSearchQuery, typeFilter, setTypeFilter, openPatient, openNewPatient } = useUIStore();
  const { language } = useClinicStore();
  const { haptic } = useTelegram();
  const t = T(language);

  useEffect(() => { fetchPatients(); }, []);

  const visible = useMemo(() => {
    return patients.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [patients, typeFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={t.search} />
          <button
            onClick={() => { haptic.impact('medium'); openNewPatient(); }}
            style={{
              width: 42, height: 42, borderRadius: 14, flexShrink: 0,
              background: C.indigo, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${C.indigo}40`,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
              <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          <Chip label={t.all} active={typeFilter === 'all'} color={C.indigo} onClick={() => setTypeFilter('all')} />
          <Chip label={t.refraction} active={typeFilter === 'refraction'} color={C.indigo} onClick={() => setTypeFilter('refraction')} />
          <Chip label={t.cataract} active={typeFilter === 'cataract'} color={C.indigo} onClick={() => setTypeFilter('cataract')} />
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 100 }}>
        <div id="patients-list" style={{ position: 'absolute', inset: 0, overflowY: 'scroll', padding: '4px 16px 100px', display: 'block', WebkitOverflowScrolling: 'touch' }}>
          {loading && patients.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted2, fontFamily: F.sans, fontSize: 14 }}>{t.loading}</div>
          )}
          {!loading && visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted2, fontFamily: F.sans, fontSize: 14 }}>
              {searchQuery ? t.noResults : t.noPatients}
            </div>
          )}
          {visible.map((p, i) => (
            <button
              key={p.id || i}
              style={{
                display: 'block', width: '100%', marginBottom: 6,
                background: 'none', border: 'none', padding: 0, textAlign: 'left',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <PatientCard patient={p} index={i} onOpen={(id) => openPatient(id, 'bio')} onDelete={deletePatient} />
            </button>
          ))}
        </div>
      </div>


      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fi-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .fi-up { animation: fi-up 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
      `}</style>
    </div>
  );
}
