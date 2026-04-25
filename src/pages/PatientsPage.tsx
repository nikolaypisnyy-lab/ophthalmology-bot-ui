import React, { useEffect, useMemo, useState } from 'react';
import { C, F, R, typeColors, eyeColors } from '../constants/design';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { useTelegram } from '../hooks/useTelegram';
import { SearchBar } from '../ui/SearchBar';
import { Chip } from '../ui/Chip';
import { Btn } from '../ui/Btn';
import type { PatientSummary } from '../types/patient';
import { newEyeData } from '../types/refraction';
import { newBiometryData } from '../types/iol';
import { useClinicStore } from '../store/useClinicStore';
import { T } from '../constants/translations';

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
  const [swiped, setSwiped] = useState(false);
  const [startX, setStartX] = useState(0);

  const tc = typeColors(patient.type);
  const ec = eyeColors((patient.eye?.toLowerCase() === 'os' ? 'os' : 'od'));

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setStartX(clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const diff = startX - clientX;
    
    if (diff > 50 && !swiped) {
      haptic.medium();
      setSwiped(true);
    } else if (diff < -40 && swiped) {
      setSwiped(false);
    }
  };

  return (
    <div style={{ position: 'relative', borderRadius: R.lg, background: C.red, overflow: 'hidden' }}>
      {/* Delete Background */}
      <div 
        onClick={(e) => { e.stopPropagation(); haptic.medium(); onDelete(String(patient.id)); }}
        style={{
          position: 'absolute', top: 0, bottom: 0, right: 0, width: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: F.sans, fontSize: 13, fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        {t.delete}
      </div>

      {/* Main Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        style={{
          position: 'relative',
          borderRadius: R.lg,
          background: C.card,
          border: `1px solid ${C.border}`,
          transform: swiped ? 'translateX(-80px)' : 'translateX(0)',
          transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animationDelay: `${index * 0.03}s`,
        }}
      >
        {/* Gender Indicator Bar */}
        <div style={{
          width: 4, height: 26, borderRadius: 2, flexShrink: 0,
          background: (patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F')) ? '#f472b6' : 
                      (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M')) ? C.od : C.border,
          boxShadow: `0 0 10px ${(patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F')) ? '#f472b640' : 
                      (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M')) ? `${C.od}40` : 'transparent'}`
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
            }}>{(patient.sex?.startsWith('Ж') || patient.sex?.toUpperCase().startsWith('F') || patient.sex?.toUpperCase().startsWith('Ж')) ? 'F' : 
                (patient.sex?.startsWith('М') || patient.sex?.toUpperCase().startsWith('M') || patient.sex?.toUpperCase().startsWith('М')) ? 'M' : 'P'}</span>
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
          }}>{patient.type === 'cataract' ? 'Cataract' : 'Refraction'}</div>
          {patient.status === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
               <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
               <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green, fontWeight: 700, opacity: 0.8 }}>{t.operated}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Форма нового пациента ─────────────────────────────────────────────────────

function NewPatientModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Partial<PatientSummary>, measurements?: any) => void;
}) {
  const { openOCR } = useUIStore();
  const { language } = useClinicStore();
  const t = T(language);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'М' | 'Ж' | ''>('');
  const [type, setType] = useState<'refraction' | 'cataract'>('refraction');
  const [eye, setEye] = useState<'OU' | 'OD' | 'OS'>('OU');
  const [ocrData, setOcrData] = useState<any>(null);

  const handleScan = () => {
    openOCR(undefined, (data) => {
      setOcrData(data);
      if (data.name || data.patient_name) setName(data.name || data.patient_name);
      if (data.age || data.patient_age) setAge(String(data.age || data.patient_age));
      const s = String(data.sex || data.patient_sex || '').toUpperCase();
      if (s.startsWith('М')) setSex('М');
      else if (s.startsWith('Ж')) setSex('Ж');
    });
  };

  const valid = name.trim().length > 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(5, 6, 12, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="fi-up"
        style={{
          background: C.bg,
          borderTop: `1px solid ${C.border}`,
          borderRadius: '32px 32px 0 0',
          padding: '24px 20px calc(24px + env(safe-area-inset-bottom,0px))',
          display: 'flex', flexDirection: 'column', gap: 16,
          maxHeight: '90vh', overflowY: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
              {t.newPatient}
            </h2>
            <p style={{ fontFamily: F.sans, fontSize: 12, color: C.muted2, margin: '4px 0 0' }}>
              {t.scanRecords}
            </p>
          </div>
          <button
            onClick={handleScan}
            style={{ 
              padding: '10px 14px', borderRadius: 14, 
              border: `1px solid ${C.indigo}40`, background: `${C.indigo}15`,
              color: C.indigo, fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer'
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M12 12h.01" strokeLinecap="round" />
            </svg>
            {t.scan}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 4 }}>{t.fullName}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John Doe"
            autoFocus
            style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: R.md, padding: '14px 16px',
              fontFamily: F.sans, fontSize: 15, color: C.text,
              outline: 'none', transition: 'all 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = C.indigo}
            onBlur={(e) => e.target.style.borderColor = C.border}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 4 }}>{t.age}</label>
            <input
              type="number"
              value={age}
              placeholder="00"
              onChange={e => setAge(e.target.value.slice(0, 3))}
              style={{
                width: '100%',
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: R.md, padding: '14px 0',
                fontFamily: F.mono, fontSize: 16, color: C.text,
                outline: 'none', textAlign: 'center',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 4 }}>{t.gender}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['М', 'Ж'].map(s => (
                <button
                  key={s}
                  onClick={() => setSex(s as any)}
                  style={{
                    flex: 1, borderRadius: R.md, padding: '14px 0',
                    fontFamily: F.sans, fontSize: 13, fontWeight: 700,
                    background: sex === s ? (s === 'М' ? C.indigo : '#f472b6') : C.surface,
                    color: sex === s ? '#fff' : C.muted2,
                    border: sex === s ? 'none' : `1px solid ${C.border}`,
                    transition: 'all 0.2s',
                  }}
                >
                  {s === 'М' ? t.male : t.female}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 4 }}>{t.clinicalPath}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['refraction', 'cataract'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  flex: 1, borderRadius: R.md, padding: '14px 0',
                  fontFamily: F.sans, fontSize: 13, fontWeight: 700,
                  background: type === t ? C.indigo : C.surface,
                  color: type === t ? '#fff' : C.muted2,
                  border: type === t ? 'none' : `1px solid ${C.border}`,
                  transition: 'all 0.2s',
                }}
              >
                {t[t as any] || (t === 'refraction' ? t.refraction : t.cataract)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 4 }}>{t.surgeryEye}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['OU', 'OD', 'OS'] as const).map(e => (
              <button
                key={e}
                onClick={() => setEye(e)}
                style={{
                  flex: 1, borderRadius: R.md, padding: '14px 0',
                  fontFamily: F.sans, fontSize: 13, fontWeight: 700,
                  background: eye === e ? C.indigo : C.surface,
                  color: eye === e ? '#fff' : C.muted2,
                  border: eye === e ? 'none' : `1px solid ${C.border}`,
                  transition: 'all 0.2s',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn
            variant="primary"
            onClick={() => valid && onSave({ name: name.trim(), age, sex: sex || undefined, type, eye }, ocrData)}
            disabled={!valid}
            full
            style={{
              padding: '16px 0', borderRadius: R.md,
              background: C.indigo,
              boxShadow: `0 8px 24px ${C.indigo}40`,
              fontWeight: 700, letterSpacing: '0.04em'
            }}
          >
            {t.createPatient}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Страница ──────────────────────────────────────────────────────────────────

export function PatientsPage() {
  const { patients, loading, fetchPatients, savePatient, deletePatient } = usePatientStore();
  const { searchQuery, setSearchQuery, typeFilter, setTypeFilter, openPatient, openOCR } = useUIStore();
  const { language } = useClinicStore();
  const t = T(language);
  const { haptic } = useTelegram();
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { fetchPatients(); }, []);

  const visible = useMemo(() => {
    return patients.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [patients, typeFilter, searchQuery]);

  const handleCreate = async (data: Partial<PatientSummary>, ocr?: any) => {
    const isCat = (data.type || 'refraction') === 'cataract';
    
    // Базовая структура
    const patientPayload: any = {
      id: '',
      name: data.name ?? '',
      age: data.age ?? '',
      sex: data.sex,  // ПОЛ ТЕПЕРЬ ТУТ ✅
      type: data.type ?? 'refraction',
      eye: data.eye ?? 'OU',
      status: 'planned',
      // Явная инициализация глаз независимыми объектами для предотвращения "зеркалирования" данных
      od: newEyeData(),
      os: newEyeData(),
      bio_od: newBiometryData(),
      bio_os: newBiometryData(),
    };

    // Если есть данные OCR, раскладываем их по полям пациента
    if (ocr) {
      if (isCat) {
        if (ocr.od) patientPayload.bio_od = { ...ocr.od };
        if (ocr.os) patientPayload.bio_os = { ...ocr.os };
      } else {
        if (ocr.od) patientPayload.od = { ...ocr.od };
        if (ocr.os) patientPayload.os = { ...ocr.os };
        // Также подхватываем общие поля (WTW, CCT и т.д. если они в корне или в k_topogram)
        if (ocr.k_topogram) {
          if (ocr.k_topogram.od) patientPayload.od = { ...(patientPayload.od || {}), ...ocr.k_topogram.od };
          if (ocr.k_topogram.os) patientPayload.os = { ...(patientPayload.os || {}), ...ocr.k_topogram.os };
        }
        if (ocr.pachymetry) {
          if (ocr.pachymetry.od) patientPayload.od = { ...(patientPayload.od || {}), ...ocr.pachymetry.od };
          if (ocr.pachymetry.os) patientPayload.os = { ...(patientPayload.os || {}), ...ocr.pachymetry.os };
        }
        if (ocr.axial_length) {
          if (ocr.axial_length.od) patientPayload.od = { ...(patientPayload.od || {}), ...ocr.axial_length.od };
          if (ocr.axial_length.os) patientPayload.os = { ...(patientPayload.os || {}), ...ocr.axial_length.os };
        }
        if (ocr.wtw) {
          if (ocr.wtw.od) patientPayload.od = { ...(patientPayload.od || {}), ...ocr.wtw.od };
          if (ocr.wtw.os) patientPayload.os = { ...(patientPayload.os || {}), ...ocr.wtw.os };
        }
      }
    }

    const newP = await savePatient(patientPayload);
    if (newP?.id) {
      setShowNew(false);
      openPatient(String(newP.id), 'bio');
    }
  };


  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 10, minHeight: 0 }}
    >
      {/* Фильтры */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={t.search} />
          <button
            onClick={() => setShowNew(true)}
            style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: C.accent, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 2px 12px ${C.accentGlow}`,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <Chip label={t.all} active={typeFilter === 'all'} color={C.accent} onClick={() => setTypeFilter('all')} />
          <Chip label={t.refraction} active={typeFilter === 'refraction'} color={C.ref} onClick={() => setTypeFilter('refraction')} />
          <Chip label={t.cataract} active={typeFilter === 'cataract'} color={C.cat} onClick={() => setTypeFilter('cataract')} />
        </div>
      </div>

      {/* Список (простая флекс-верстка вместо абсолюта) */}
      <div id="patients-list" style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '4px 16px 100px',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'none',
        position: 'relative',
        zIndex: 100, // Чтобы точно быть сверху
        minHeight: 0
      }}>
        {loading && patients.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
            {t.loading}
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
              {searchQuery ? t.noResults : t.noPatients}
          </div>
        )}
        {visible.map((p, i) => (
          <button
            key={p.id || i}
            id={`patient-btn-${p.id}`}
            onClick={(e) => {
              e.stopPropagation();
              haptic.light();
              openPatient(String(p.id), 'bio');
            }}
            style={{
              display: 'block', width: '100%', marginBottom: 10,
              background: 'none', border: 'none', padding: 0,
              textAlign: 'left', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
              zIndex: 101
            }}
          >
            <PatientCard
              patient={p}
              index={i}
              onOpen={(id) => openPatient(id, 'bio')}
              onDelete={deletePatient}
            />
          </button>
        ))}
      </div>

      {showNew && (
        <NewPatientModal
          onClose={() => setShowNew(false)}
          onSave={handleCreate}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fi-up {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fi-up { animation: fi-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
