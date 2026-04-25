import React, { useState } from 'react';
import { C, F } from '../../constants/design';
import { useUIStore } from '../../store/useUIStore';
import { useClinicStore } from '../../store/useClinicStore';
import { API_BASE, TELEGRAM_ID, apiPost } from '../../api/client';
import { LASERS } from '../../constants/lasers';

export function SettingsModal() {
  const { settingsOpen, closeSettings } = useUIStore();
  const { clinics, activeClinicId, activeName, activeLaser, switchClinic, setActiveLaser } = useClinicStore();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  const handleSwitchClinic = (id: string) => {
    if (id === activeClinicId) return;
    // Сохраняем новую клинику в localStorage и перезагружаем страницу —
    // это сбрасывает весь in-memory стейт и загружает пациентов нужной клиники
    switchClinic(id);
    window.location.reload();
  };

  if (!settingsOpen) return null;

  const handleExportTelegram = async () => {
    try {
      setLoading(true);
      setMsg({ text: 'Отправка базы в Telegram...', type: 'info' });
      
      const response: any = await apiPost('/database/export_telegram', {});
      if (response.status === 'error') throw new Error(response.detail || 'Ошибка отправки');
      
      setMsg({ text: 'База успешно отправлена вам в Telegram!', type: 'info' });
    } catch (e: any) {
      setMsg({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportFile = async () => {
    try {
      setLoading(true);
      setMsg({ text: 'Запрос на скачивание...', type: 'info' });
      
      // Прямое скачивание через window.open (надежнее для мобильных браузеров в WebApp)
      const downloadUrl = `${window.location.origin}${API_BASE}/database/export?tid=${TELEGRAM_ID}`;
      window.open(downloadUrl, '_blank');
      
      setMsg({ text: 'Попытка скачивания запущена!', type: 'info' });
    } catch (e: any) {
      setMsg({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('ВНИМАНИЕ: Импорт полностью ЗАМЕНИТ текущую базу данных. Вы уверены?')) {
      return;
    }

    try {
      setLoading(true);
      setMsg({ text: 'Загрузка базы...', type: 'info' });
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${window.location.origin}${API_BASE}/database/import`, {
        method: 'POST',
        headers: { 'telegram-id': String(TELEGRAM_ID) },
        body: formData
      });
      
      if (!response.ok) throw new Error('Ошибка импорта');
      
      setMsg({ text: 'База успешно импортирована! Приложение будет перезагружено.', type: 'info' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setMsg({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const OverlayStyles: React.CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 1000,
    background: 'rgba(5, 5, 10, 0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex', flexDirection: 'column',
    animation: 'fadeIn 0.28s ease'
  };

  return (
    <div style={OverlayStyles} onClick={closeSettings}>
      <div 
        style={{
          width: '100%', maxWidth: 400, margin: 'auto auto 0',
          background: C.surface, borderTop: `1px solid ${C.border}`,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: '24px 20px 48px',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontFamily: F.sans, fontSize: 20, fontWeight: 700, color: C.text }}>Настройки</h2>
          <button 
            onClick={closeSettings}
            style={{ 
              width: 32, height: 32, borderRadius: '50%', background: C.surface2, 
              border: 'none', color: C.muted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >✕</button>
        </div>

        {/* Текущая клиника */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: `linear-gradient(135deg, ${C.accentLt}, rgba(91,79,212,0.08))`,
          border: `1px solid ${C.accent}30`,
          borderRadius: 16, padding: '12px 14px', marginBottom: 20,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.accent}, #5b4fd4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${C.accentGlow}`,
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: C.accent, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              Текущая база данных
            </div>
            <div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeName ?? 'Загрузка...'}
            </div>
          </div>
        </div>

        {/* Сообщение */}
        {msg && (
          <div style={{
            padding: '12px 16px', borderRadius: 12, marginBottom: 20,
            background: msg.type === 'error' ? C.redLt : C.accentLt,
            border: `1px solid ${msg.type === 'error' ? C.red : C.accent}30`,
            color: msg.type === 'error' ? C.red : C.accent,
            fontFamily: F.sans, fontSize: 13, fontWeight: 500
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ paddingBottom: 8, borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Работа с данными (SQLite)</span>
          </div>

          <button 
            onClick={handleExportTelegram}
            disabled={loading}
            style={{
              padding: '14px', borderRadius: 14, background: C.surface2, border: `1px solid ${C.border}`,
              color: C.text, fontFamily: F.sans, fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: loading ? 0.5 : 1,
              transition: 'transform 0.1s'
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accentLt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </div>
            Прислать в Telegram бота
          </button>

          <button 
            onClick={handleExportFile}
            disabled={loading}
            style={{
              padding: '10px 14px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted2, fontFamily: F.sans, fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', opacity: loading ? 0.5 : 1
            }}
          >
            <div style={{ width: 28, height: 28, borderRadius: 8, background: C.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted2} strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </div>
            Скачать на устройство (.db)
          </button>

          <label style={{
            padding: '14px', borderRadius: 14, background: C.surface2, border: `1px solid ${C.border}`,
            color: C.text, fontFamily: F.sans, fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 12, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1
          }}>
            <input type="file" accept=".db" onChange={handleImport} disabled={loading} style={{ display: 'none' }} />
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.osLt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.os} strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            </div>
            Загрузить базу пациентов (.db)
          </label>

          {/* Переключатель клиник */}
          {clinics.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ paddingBottom: 8, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Клиника</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {clinics.map(c => {
                  const active = c.clinic_id === activeClinicId;
                  return (
                    <button
                      key={c.clinic_id}
                      onClick={() => handleSwitchClinic(c.clinic_id)}
                      style={{
                        padding: '10px 14px', borderRadius: 14,
                        background: active ? C.accentLt : C.surface2,
                        border: `1px solid ${active ? C.accent : C.border}`,
                        color: active ? C.accent : C.text,
                        fontFamily: F.sans, fontSize: 13, fontWeight: active ? 700 : 500,
                        display: 'flex', alignItems: 'center', gap: 10,
                        cursor: active ? 'default' : 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: active ? C.accent : C.border, flexShrink: 0,
                      }} />
                      <span style={{ flex: 1 }}>{c.clinic_name}</span>
                      <span style={{ fontSize: 10, opacity: 0.6 }}>{c.role}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Настройки лазера */}
          {activeClinicId && (
            <div style={{ marginTop: 12 }}>
              <div style={{ paddingBottom: 8, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Лазер клиники</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {LASERS.map(l => {
                  const active = l.id === activeLaser;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setActiveLaser(l.id)}
                      style={{
                        padding: '8px 4px', borderRadius: 12,
                        background: active ? `${l.color}20` : C.surface2,
                        border: `1px solid ${active ? l.color : C.border}`,
                        color: active ? l.color : C.text,
                        fontFamily: F.sans, fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', textAlign: 'center', transition: 'all .15s'
                      }}
                    >
                      {l.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 20, textAlign: 'center', color: C.muted, fontSize: 12, fontFamily: F.sans, opacity: 0.6 }}>
            RefMaster Surgical OCR v2.3.1
          </div>
        </div>
      </div>
    </div>
  );
}
