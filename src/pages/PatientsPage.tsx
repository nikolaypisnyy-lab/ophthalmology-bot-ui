import React, { useEffect, useMemo, useState } from 'react';
import { C, F, typeColors, eyeColors } from '../constants/design';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { useTelegram } from '../hooks/useTelegram';
import { SearchBar } from '../ui/SearchBar';
import { Chip } from '../ui/Chip';
import { Btn } from '../ui/Btn';
import type { PatientSummary } from '../types/patient';
import { newEyeData } from '../types/refraction';
import { newBiometryData } from '../types/iol';

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
  const [swiped, setSwiped] = useState(false);
  const [startX, setStartX] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const timerRef = React.useRef<any>(null);

  const startPress = () => {
    timerRef.current = setTimeout(() => {
      haptic.medium();
      setShowMenu(true);
    }, 600);
  };

  const cancelPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const tc = typeColors(patient.type);
  const ec = eyeColors((patient.eye?.toLowerCase() === 'os' ? 'os' : 'od'));

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const M = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    return `${+day} ${M[+m - 1]} ${y}`;
  };

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'pan-y',
      }}
      onContextMenu={e => e.preventDefault()}
      onTouchStart={e => {
        setStartX(e.touches[0].clientX);
        startPress();
      }}
      onTouchEnd={e => {
        cancelPress();
        const delta = e.changedTouches[0].clientX - startX;
        if (delta < -60) setSwiped(true);
        else if (delta > 20) setSwiped(false);
      }}
      onTouchMove={cancelPress}
    >
      {/* Удалить (свайп) */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 72, background: C.red + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
        onClick={() => { onDelete(String(patient.id)); setSwiped(false); }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.red} strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </div>

      {/* Основная карточка */}
      <div
        onClick={() => {
          const pid = String(patient.id ?? '');
          if (!swiped && pid && pid !== 'undefined') onOpen(pid);
        }}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          transform: swiped ? 'translateX(-72px)' : 'translateX(0)',
          transition: 'transform .25s cubic-bezier(.16,1,.3,1)',
          position: 'relative',
          animationDelay: `${index * 0.04}s`,
        }}
      >
        {/* Аватар */}
        <div
          style={{
            width: 40, height: 40, borderRadius: 14, flexShrink: 0,
            background: patient.sex === 'М'
              ? 'linear-gradient(135deg, #1e3a8a, #1d4ed8)'
              : patient.sex === 'Ж'
              ? 'linear-gradient(135deg, #831843, #be185d)'
              : `linear-gradient(135deg,${tc.color}30,${tc.color}10)`,
            border: patient.sex === 'М'
              ? '1px solid #3b82f640'
              : patient.sex === 'Ж'
              ? '1px solid #ec489940'
              : `1px solid ${tc.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: patient.sex ? 20 : 13, fontWeight: 700,
            color: patient.sex ? '#fff' : tc.color,
          }}
        >
          {patient.sex === 'М' ? '♂' : patient.sex === 'Ж' ? '♀' : initials(patient.name)}
        </div>

        {/* Инфо */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {patient.name}
            </span>
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: F.mono, opacity: 0.7, color: C.accent }}>#{patient.id}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{patient.age} лет</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: ec.color, fontWeight: 600 }}>{patient.eye}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{fmtDate(patient.date)}</span>
          </div>
        </div>

        {/* Бейдж + результат */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            background: tc.bg, color: tc.color,
            fontFamily: F.sans, fontSize: 10, fontWeight: 600,
            padding: '2px 8px', borderRadius: 20,
          }}>
            {patient.type === 'cataract' ? 'Катаракта' : 'Рефракция'}
          </span>
          {patient.status === 'done' && (
            <span style={{ fontFamily: F.sans, fontSize: 10, color: C.green, fontWeight: 700 }}>
              {patient.sex === 'Ж' ? 'ПРООПЕРИРОВАНА' : 'ПРООПЕРИРОВАН'} ✓
            </span>
          )}
        </div>
      </div>

      {/* Меню удаления (по лонг-прессу) */}
      {showMenu && (
        <div 
          onClick={() => setShowMenu(false)}
          className="fi"
          style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)', borderRadius: 14,
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
              style={{
                padding: '10px 16px', borderRadius: 12,
                background: C.surface3, border: `1px solid ${C.border}`,
                color: C.text, fontFamily: F.sans, fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                haptic.medium();
                onDelete(String(patient.id));
                setShowMenu(false);
              }}
              style={{
                padding: '10px 16px', borderRadius: 12,
                background: C.red, border: 'none',
                color: '#fff', fontFamily: F.sans, fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: `0 4px 12px ${C.red}40`,
              }}
            >
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Форма нового пациента ─────────────────────────────────────────────────────

function NewPatientModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Partial<PatientSummary>, measurements?: any) => void;
}) {
  const { openOCR } = useUIStore();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'М' | 'Ж' | ''>('');
  const [type, setType] = useState<'refraction' | 'cataract'>('refraction');
  const [eye, setEye] = useState<'OU' | 'OD' | 'OS'>('OU');
  const [ocrData, setOcrData] = useState<any>(null);

  const handleScan = () => {
    openOCR(undefined, (data) => {
      setOcrData(data);
      if (data.name) setName(data.name);
      else if (data.patient_name) setName(data.patient_name);
      
      if (data.age) setAge(String(data.age));
      else if (data.patient_age) setAge(String(data.patient_age));

      if (data.sex) {
        const s = String(data.sex).toUpperCase();
        if (s.startsWith('М')) setSex('М');
        else if (s.startsWith('Ж')) setSex('Ж');
      } else if (data.patient_sex) {
        const s = String(data.patient_sex).toUpperCase();
        if (s.startsWith('М')) setSex('М');
        else if (s.startsWith('Ж')) setSex('Ж');
      }

      const isCat = type === 'cataract';
      
      if (data.od) {
        if (isCat) {
          setOcrData((prev: any) => ({
            ...prev,
            od: {
              ...prev?.od,
              al: data.od.al ?? prev?.od?.al,
              acd: data.od.acd ?? prev?.od?.acd,
              lt: data.od.lt ?? prev?.od?.lt,
              wtw: data.od.wtw ?? prev?.od?.wtw,
              k1: data.od.k1 ?? prev?.od?.k1,
              k2: data.od.k2 ?? prev?.od?.k2,
              k1_ax: data.od.k1_ax ?? prev?.od?.k1_ax,
            }
          }));
        }
      }
      if (data.os) {
        if (isCat) {
          setOcrData((prev: any) => ({
            ...prev,
            os: {
              ...prev?.os,
              al: data.os.al ?? prev?.os?.al,
              acd: data.os.acd ?? prev?.os?.acd,
              lt: data.os.lt ?? prev?.os?.lt,
              wtw: data.os.wtw ?? prev?.os?.wtw,
              k1: data.os.k1 ?? prev?.os?.k1,
              k2: data.os.k2 ?? prev?.os?.k2,
              k1_ax: data.os.k1_ax ?? prev?.os?.k1_ax,
            }
          }));
        }
      }

      if (data.type) setType(data.type);
      if (data.eye) {
        const e = String(data.eye).toUpperCase();
        if (e === 'OD' || e === 'OS' || e === 'OU') setEye(e as any);
      }
    });
  };

  const valid = name.trim().length > 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(3, 5, 8, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="fi-up"
        style={{
          background: 'linear-gradient(180deg, rgba(28,32,52,0.98) 0%, rgba(17,20,32,1) 100%)',
          borderTop: `1px solid rgba(255,255,255,0.12)`,
          boxShadow: '0 -24px 80px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.06)',
          borderRadius: '28px 28px 0 0',
          padding: '20px 16px calc(20px + env(safe-area-inset-bottom,0px))',
          display: 'flex', flexDirection: 'column', gap: 12,
          maxHeight: '90vh', overflowY: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontFamily: F.sans, fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
              Новый пациент
            </h2>
            <p style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, margin: '2px 0 0' }}>
              Введите данные или используйте скан документа
            </p>
          </div>
          <Btn
            variant="ghost"
            small
            onClick={handleScan}
            style={{ 
              padding: '8px 16px', borderRadius: 20, 
              border: `1px solid ${C.accent}40`, background: `${C.accent}10`,
              color: C.accent, fontWeight: 600 
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
            Скан
          </Btn>
        </div>

        {/* Имя */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ФИО Пациента</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Фамилия Имя Отчество"
            autoFocus
            style={{
              background: C.surface3, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: '11px 14px',
              fontFamily: F.sans, fontSize: 14, color: C.text,
              outline: 'none', transition: 'border-color 0.2s',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
            }}
            onFocus={(e) => e.target.style.borderColor = C.accent}
            onBlur={(e) => e.target.style.borderColor = C.border}
          />
        </div>
        {/* Сетка: Возраст и Пол */}
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 10 }}>
          {/* Возраст */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Лет</label>
            <input
              type="number"
              value={age}
              placeholder="00"
              onChange={e => setAge(e.target.value.slice(0, 3))}
              style={{
                width: '100%',
                background: C.surface3, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: '11px 0',
                fontFamily: F.mono, fontSize: 15, color: C.text,
                outline: 'none', textAlign: 'center',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}
            />
          </div>

          {/* Пол */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Пол</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSex('М')}
                style={{
                  flex: 1, borderRadius: 20, padding: '11px 0',
                  fontFamily: F.sans, fontSize: 13, fontWeight: 800,
                  background: sex === 'М' ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' : C.surface3,
                  color: sex === 'М' ? '#fff' : C.muted,
                  border: sex === 'М' ? 'none' : `1px solid ${C.border}`,
                  transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: sex === 'М' ? 'scale(1.02)' : 'none',
                  boxShadow: sex === 'М' ? '0 4px 15px rgba(59, 130, 246, 0.4)' : 'none'
                }}
              >
                ♂ МУЖ
              </button>
              <button
                onClick={() => setSex('Ж')}
                style={{
                  flex: 1, borderRadius: 20, padding: '11px 0',
                  fontFamily: F.sans, fontSize: 13, fontWeight: 800,
                  background: sex === 'Ж' ? 'linear-gradient(135deg, #EC4899, #BE185D)' : C.surface3,
                  color: sex === 'Ж' ? '#fff' : C.muted,
                  border: sex === 'Ж' ? 'none' : `1px solid ${C.border}`,
                  transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: sex === 'Ж' ? 'scale(1.02)' : 'none',
                  boxShadow: sex === 'Ж' ? '0 4px 15px rgba(236, 72, 153, 0.4)' : 'none'
                }}
              >
                ♀ ЖЕН
              </button>
            </div>
          </div>
        </div>

        {/* Тип */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Направление</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['refraction', 'cataract'] as const).map(t => (
              <Chip
                key={t}
                label={t === 'refraction' ? 'Рефракция' : 'Катаракта'}
                active={type === t}
                color={t === 'refraction' ? C.ref : C.cat}
                onClick={() => setType(t)}
                style={{
                  flex: 1, padding: '10px 0', justifyContent: 'center', borderRadius: 20,
                  boxShadow: type === t ? `0 3px 10px ${t === 'refraction' ? C.ref : C.cat}40` : 'none'
                }}
              />
            ))}
          </div>
        </div>

        {/* Глаз */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Оперируемый глаз</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['OU', 'OD', 'OS'] as const).map(e => (
              <Chip
                key={e}
                label={e === 'OU' ? 'Оба глаза' : e}
                active={eye === e}
                color={e === 'OD' ? C.od : e === 'OS' ? C.os : C.accent}
                onClick={() => setEye(e)}
                style={{
                  flex: 1, padding: '10px 0', justifyContent: 'center', borderRadius: 20,
                  boxShadow: eye === e ? `0 3px 10px ${e === 'OD' ? C.od : e === 'OS' ? C.os : C.accent}40` : 'none'
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn
            variant="outline"
            onClick={onClose}
            full
            style={{ padding: '13px 0', borderRadius: 20, borderColor: C.border, color: C.muted }}
          >
            Отмена
          </Btn>
          <Btn
            variant="primary"
            onClick={() => valid && onSave({ name: name.trim(), age, sex: sex || undefined, type, eye }, ocrData)}
            disabled={!valid}
            full
            style={{
              padding: '13px 0', borderRadius: 20,
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentGlow})`,
              boxShadow: `0 8px 20px ${C.accentGlow}50`,
              fontWeight: 800, letterSpacing: '0.5px'
            }}
          >
            Добавить пациента
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Фильтры */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <button
            onClick={() => setShowNew(true)}
            style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: C.accent, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 2px 12px ${C.accentGlow}`,
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <Chip label="Все" active={typeFilter === 'all'} color={C.accent} onClick={() => setTypeFilter('all')} />
          <Chip label="Рефракция" active={typeFilter === 'refraction'} color={C.ref} onClick={() => setTypeFilter('refraction')} />
          <Chip label="Катаракта" active={typeFilter === 'cataract'} color={C.cat} onClick={() => setTypeFilter('cataract')} />
        </div>
      </div>

      {/* Список с абсолютным позиционированием */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ 
          position: 'absolute', inset: 0,
          overflowY: 'auto', 
          padding: '4px 16px 100px', 
          display: 'block', 
          WebkitOverflowScrolling: 'touch' 
        }}>
          {loading && patients.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
              Загрузка...
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
              {searchQuery ? 'Ничего не найдено' : 'Нет пациентов'}
            </div>
          )}
          {visible.map((p, i) => (
            <div key={p.id || i} style={{ display: 'block', width: '100%', marginBottom: 10 }}>
              <PatientCard
                patient={p}
                index={i}
                onOpen={id => openPatient(id, 'bio')}
                onDelete={deletePatient}
              />
            </div>
          ))}
        </div>
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
