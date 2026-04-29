import { useState } from 'react';
import { C, F, R } from '../../constants/design';
import { useUIStore } from '../../store/useUIStore';
import { useClinicStore } from '../../store/useClinicStore';
import { usePatientStore } from '../../store/usePatientStore';
import { useTelegram } from '../../hooks/useTelegram';
import { Btn } from '../../ui/Btn';
import { T } from '../../constants/translations';
import { newEyeData } from '../../types/refraction';
import { newBiometryData } from '../../types/iol';
import type { PatientSummary } from '../../types/patient';

export function NewPatientModal() {
  const { closeNewPatient, showNewPatientModal, openOCR, openPatient } = useUIStore();
  const { savePatient } = usePatientStore();
  const { language } = useClinicStore();
  const t = T(language);
  const { haptic } = useTelegram();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'М' | 'Ж' | ''>('');
  const [type, setType] = useState<'refraction' | 'cataract'>('refraction');
  const [eye, setEye] = useState<'OU' | 'OD' | 'OS'>('OU');
  const [ocrData, setOcrData] = useState<any>(null);

  if (!showNewPatientModal) return null;

  const handleScan = () => {
    openOCR(undefined, (data) => {
      setOcrData(data);
      if (data.name || data.patient_name) setName(data.name || data.patient_name);
      if (data.age || data.patient_age) setAge(String(data.age || data.patient_age));
      const s = String(data.sex || data.patient_sex || '').toUpperCase();
      if (s.startsWith('М') || s.startsWith('M')) setSex('М');
      else if (s.startsWith('Ж') || s.startsWith('F')) setSex('Ж');
    });
  };

  const onSave = async (data: Partial<PatientSummary>, ocr?: any) => {
    const isCat = (data.type || 'refraction') === 'cataract';
    
    const patientPayload: any = {
      id: '',
      name: data.name ?? '',
      age: data.age ?? '',
      sex: data.sex,
      type: data.type ?? 'refraction',
      eye: data.eye ?? 'OU',
      status: 'planned',
      od: newEyeData(),
      os: newEyeData(),
      bio_od: newBiometryData(),
      bio_os: newBiometryData(),
    };

    if (ocr) {
      if (isCat) {
        if (ocr.od) patientPayload.bio_od = { ...newBiometryData(), ...ocr.od };
        if (ocr.os) patientPayload.bio_os = { ...newBiometryData(), ...ocr.os };
      } else {
        if (ocr.od) patientPayload.od = { ...newEyeData(), ...ocr.od };
        if (ocr.os) patientPayload.os = { ...newEyeData(), ...ocr.os };
        const sections = ['k_topogram', 'pachymetry', 'axial_length', 'wtw'];
        sections.forEach(sec => {
          if (ocr[sec]) {
            if (ocr[sec].od) patientPayload.od = { ...patientPayload.od, ...ocr[sec].od };
            if (ocr[sec].os) patientPayload.os = { ...patientPayload.os, ...ocr[sec].os };
          }
        });
      }
    }

    const newP = await savePatient(patientPayload);
    if (newP?.id) {
      closeNewPatient();
      openPatient(String(newP.id), 'bio');
    }
  };

  const valid = name.trim().length > 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(5, 6, 12, 0.85)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={closeNewPatient}
    >
      <div
        className="fi-up"
        style={{
          background: C.bg, borderTop: `1px solid ${C.border}`, borderRadius: '32px 32px 0 0',
          padding: '24px 20px calc(24px + env(safe-area-inset-bottom,0px))',
          display: 'flex', flexDirection: 'column', gap: 16,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>{t.newPatient}</h2>
            <p style={{ fontFamily: F.sans, fontSize: 12, color: C.muted2, margin: '4px 0 0' }}>{t.scanRecords}</p>
          </div>
          <button
            onClick={handleScan}
            style={{ 
              padding: '10px 14px', borderRadius: 14, 
              border: `1px solid ${C.indigo}40`, background: `${C.indigo}15`,
              color: C.indigo, fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M12 12h.01" />
            </svg>
            {t.scan}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', marginLeft: 4 }}>{t.fullName}</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="John Doe" autoFocus
            style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: R.md, padding: '14px 16px',
              fontFamily: F.sans, fontSize: 16, color: C.text, outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', marginLeft: 4 }}>{t.age}</label>
            <input
              type="number" value={age} placeholder="00"
              onChange={e => setAge(e.target.value.slice(0, 3))}
              style={{
                width: '100%', background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: R.md, padding: '14px 0',
                fontFamily: F.mono, fontSize: 16, color: C.text, outline: 'none', textAlign: 'center',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', marginLeft: 4 }}>{t.gender}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['М', 'Ж'].map(s => (
                <button
                  key={s} onClick={() => setSex(s as any)}
                  style={{
                    flex: 1, borderRadius: R.md, padding: '14px 0',
                    fontFamily: F.sans, fontSize: 13, fontWeight: 700,
                    background: sex === s ? (s === 'М' ? C.indigo : '#f472b6') : C.surface,
                    color: sex === s ? '#fff' : C.muted2,
                    border: sex === s ? 'none' : `1px solid ${C.border}`,
                  }}
                >
                  {s === 'М' ? t.male : t.female}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', marginLeft: 4 }}>{t.clinicalPath}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['refraction', 'cataract'] as const).map(tKey => (
              <button
                key={tKey} onClick={() => setType(tKey)}
                style={{
                  flex: 1, borderRadius: R.md, padding: '14px 0',
                  fontFamily: F.sans, fontSize: 13, fontWeight: 700,
                  background: type === tKey ? C.indigo : C.surface,
                  color: type === tKey ? '#fff' : C.muted2,
                  border: type === tKey ? 'none' : `1px solid ${C.border}`,
                }}
              >
                {tKey === 'refraction' ? t.refraction : t.cataract}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: F.mono, fontSize: 10, color: C.muted2, fontWeight: 700, textTransform: 'uppercase', marginLeft: 4 }}>{t.surgeryEye}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['OU', 'OD', 'OS'] as const).map(e => (
              <button
                key={e} onClick={() => setEye(e)}
                style={{
                  flex: 1, borderRadius: R.md, padding: '14px 0',
                  fontFamily: F.sans, fontSize: 13, fontWeight: 700,
                  background: eye === e ? C.indigo : C.surface,
                  color: eye === e ? '#fff' : C.muted2,
                  border: eye === e ? 'none' : `1px solid ${C.border}`,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <Btn
          variant="primary"
          onClick={() => valid && onSave({ name: name.trim(), age, sex: sex || undefined, type, eye }, ocrData)}
          disabled={!valid}
          full
          style={{ padding: '16px 0', marginTop: 12, borderRadius: R.md, fontWeight: 800 }}
        >
          {t.createPatient}
        </Btn>
      </div>
    </div>
  );
}
