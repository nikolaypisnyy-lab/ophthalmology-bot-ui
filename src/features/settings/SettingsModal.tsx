import React, { useState } from 'react';
import { C, F, R } from '../../constants/design';
import { useUIStore } from '../../store/useUIStore';
import { useClinicStore } from '../../store/useClinicStore';
import { API_BASE, TELEGRAM_ID, apiPost } from '../../api/client';
import { LASERS } from '../../constants/lasers';
import { useTelegram } from '../../hooks/useTelegram';
import { T } from '../../constants/translations';

export function SettingsModal() {
  const { settingsOpen, closeSettings } = useUIStore();
  const { 
    clinics, activeClinicId, activeName, activeLaser, language, 
    activeRefNomo, activeRefNomoCyl, recommendedNomo, recommendedNomoCyl,
    switchClinic, setActiveLaser, setLanguage, setRefNomo, setRefNomoCyl 
  } = useClinicStore();
  const { haptic } = useTelegram();
  const t = T(language);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  if (!settingsOpen) return null;

  const handleSwitchClinic = (id: string) => {
    if (id === activeClinicId) return;
    haptic.medium();
    switchClinic(id);
  };

  const handleExportTelegram = async () => {
    try {
      setLoading(true);
      haptic.light();
      setMsg({ text: t.loading, type: 'info' });
      const response: any = await apiPost('/database/export_telegram', {});
      if (response.status === 'error') throw new Error(response.detail || 'Error');
      setMsg({ text: t.dbSentTelegram, type: 'info' });
      haptic.notification('success');
    } catch (e: any) {
      setMsg({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportFile = async () => {
    try {
      setLoading(true);
      haptic.light();
      const downloadUrl = `${window.location.origin}${API_BASE}/database/export?tid=${TELEGRAM_ID}`;
      window.open(downloadUrl, '_blank');
      setMsg({ text: 'Download started!', type: 'info' });
    } catch (e: any) {
      setMsg({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(t.importWarning)) return;

    try {
      setLoading(true);
      haptic.impact('heavy');
      setMsg({ text: t.loading, type: 'info' });
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${window.location.origin}${API_BASE}/database/import`, {
        method: 'POST',
        headers: { 'telegram-id': String(TELEGRAM_ID) },
        body: formData
      });
      
      if (!response.ok) throw new Error('Import error');
      
      setMsg({ text: t.dbImported, type: 'info' });
      haptic.notification('success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setMsg({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        position: 'absolute', inset: 0, zIndex: 1000,
        background: 'rgba(5, 6, 12, 0.9)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.3s ease'
      }} 
      onClick={() => { haptic.light(); closeSettings(); }}
    >
      <div 
        style={{
          width: '100%', maxWidth: 480, margin: 'auto auto 0',
          background: C.bg, borderTop: `1px solid ${C.border}`,
          borderRadius: '32px 32px 0 0',
          padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          maxHeight: '90vh', overflowY: 'auto',
          scrollbarWidth: 'none'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontFamily: F.sans, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>{t.settings}</h2>
          <button 
            onClick={() => { haptic.light(); closeSettings(); }}
            style={{ 
              width: 36, height: 36, borderRadius: '50%', background: C.surface, 
              border: `1px solid ${C.border}`, color: C.muted2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >✕</button>
        </div>

        {/* Current Clinic */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: `linear-gradient(135deg, ${C.indigo}15, rgba(99,102,241,0.05))`,
          border: `1px solid ${C.indigo}30`,
          borderRadius: 20, padding: '14px 16px', marginBottom: 24,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: C.indigo,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 8px 20px ${C.indigo}40`,
          }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 900, color: C.indigo, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>
              {t.currentDb}
            </div>
            <div style={{ fontFamily: F.sans, fontSize: 16, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeName || 'Loading...'}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {msg && (
          <div style={{
            padding: '14px 18px', borderRadius: 16, marginBottom: 24,
            background: msg.type === 'error' ? `${C.red}15` : `${C.indigo}10`,
            border: `1px solid ${msg.type === 'error' ? C.red : C.indigo}30`,
            color: msg.type === 'error' ? C.red : C.indigo,
            fontFamily: F.sans, fontSize: 14, fontWeight: 700
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Laser Settings */}
          <div style={{ marginTop: 4 }}>
            <div style={{ paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t.clinicLaser}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {LASERS.map(l => {
                const active = l.id === activeLaser;
                return (
                  <button
                    key={l.id}
                    onClick={() => { haptic.selection(); setActiveLaser(l.id); }}
                    style={{
                      padding: '10px 4px', borderRadius: 14,
                      background: active ? `${l.color}20` : C.surface,
                      border: `1px solid ${active ? l.color : C.border}`,
                      color: active ? l.color : C.text,
                      fontFamily: F.sans, fontSize: 11, fontWeight: 900,
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                      boxShadow: active ? `0 4px 12px ${l.color}30` : 'none'
                    }}
                  >
                    {l.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Nomogram Settings */}
            <div style={{ background: `${C.surface}80`, borderRadius: 20, padding: '14px', border: `1px solid ${C.border}40`, display: 'flex', flexDirection: 'column', gap: 12 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <span style={{ fontSize: 9, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>Sph Offset (Nomogram)</span>
                   <span style={{ fontSize: 8, color: C.indigo, fontWeight: 800 }}>REC: {recommendedNomo !== null ? (recommendedNomo > 0 ? '+' : '') + recommendedNomo.toFixed(2) : '—'}</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => { haptic.selection(); setRefNomo((activeRefNomo || 0) - 0.05); }} style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 900 }}>−</button>
                    <span style={{ width: 50, textAlign: 'center', fontFamily: F.mono, fontSize: 15, fontWeight: 900, color: C.text }}>{activeRefNomo !== null ? (activeRefNomo > 0 ? '+' : '') + activeRefNomo.toFixed(2) : '0.00'}</span>
                    <button onClick={() => { haptic.selection(); setRefNomo((activeRefNomo || 0) + 0.05); }} style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 900 }}>+</button>
                 </div>
               </div>
               
               <div style={{ height: 1, background: C.border, opacity: 0.3 }} />

               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <span style={{ fontSize: 9, fontWeight: 900, color: C.muted2, textTransform: 'uppercase' }}>Cyl Offset (Nomogram)</span>
                   <span style={{ fontSize: 8, color: C.indigo, fontWeight: 800 }}>REC: {recommendedNomoCyl !== null ? (recommendedNomoCyl > 0 ? '+' : '') + recommendedNomoCyl.toFixed(2) : '—'}</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => { haptic.selection(); setRefNomoCyl((activeRefNomoCyl || 0) - 0.05); }} style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 900 }}>−</button>
                    <span style={{ width: 50, textAlign: 'center', fontFamily: F.mono, fontSize: 15, fontWeight: 900, color: C.text }}>{activeRefNomoCyl !== null ? (activeRefNomoCyl > 0 ? '+' : '') + activeRefNomoCyl.toFixed(2) : '0.00'}</span>
                    <button onClick={() => { haptic.selection(); setRefNomoCyl((activeRefNomoCyl || 0) + 0.05); }} style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 900 }}>+</button>
                 </div>
               </div>
            </div>
          </div>

          {/* Language Settings */}
          <div style={{ marginTop: 4 }}>
            <div style={{ paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t.language}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['ru', 'en'].map(l => {
                const active = l === language;
                return (
                  <button
                    key={l}
                    onClick={() => { haptic.selection(); setLanguage(l as any); }}
                    style={{
                      padding: '12px', borderRadius: 16,
                      background: active ? `${C.indigo}15` : C.surface,
                      border: `1px solid ${active ? C.indigo : C.border}`,
                      color: active ? C.indigo : C.text,
                      fontFamily: F.sans, fontSize: 13, fontWeight: 900,
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                      textTransform: 'uppercase'
                    }}
                  >
                    {l === 'ru' ? 'Русский' : 'English'}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t.dataManagement}</span>
          </div>

          <button 
            onClick={handleExportTelegram}
            disabled={loading}
            style={{
              padding: '16px', borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`,
              color: C.text, fontFamily: F.sans, fontSize: 15, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.indigo}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.indigo} strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            {t.sendTelegram}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button 
              onClick={handleExportFile}
              disabled={loading}
              style={{
                padding: '14px', borderRadius: 18, background: 'transparent', border: `1px solid ${C.border}`,
                color: C.muted2, fontFamily: F.sans, fontSize: 12, fontWeight: 800,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: loading ? 0.5 : 1
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}` }}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.muted2} strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {t.downloadDevice}
            </button>

            <label style={{
              padding: '14px', borderRadius: 18, background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted2, fontFamily: F.sans, fontSize: 12, fontWeight: 800,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1
            }}>
              <input type="file" accept=".db" onChange={handleImport} disabled={loading} style={{ display: 'none' }} />
              <div style={{ width: 32, height: 32, borderRadius: 10, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}` }}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.muted2} strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {t.uploadDb}
            </label>
          </div>

          {/* Clinic Switcher */}
          {clinics.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: C.muted2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t.clinic}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clinics.map(c => {
                  const active = c.clinic_id === activeClinicId;
                  return (
                    <button
                      key={c.clinic_id}
                      onClick={() => handleSwitchClinic(c.clinic_id)}
                      style={{
                        padding: '12px 16px', borderRadius: 16,
                        background: active ? `${C.indigo}15` : C.surface,
                        border: `1px solid ${active ? C.indigo : C.border}`,
                        color: active ? C.indigo : C.text,
                        fontFamily: F.sans, fontSize: 14, fontWeight: active ? 800 : 600,
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: active ? 'default' : 'pointer', textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: active ? C.indigo : C.border, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{c.clinic_name}</span>
                      <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 900 }}>{c.role.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, textAlign: 'center', color: C.muted3, fontSize: 11, fontFamily: F.mono, fontWeight: 700, opacity: 0.6, letterSpacing: '0.04em' }}>
            REFMASTER SURGICAL · V2.4.0 · PRO
          </div>
        </div>
      </div>
    </div>
  );
}
