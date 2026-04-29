import React, { useState } from 'react';
import { C, F, R, typeColors, eyeColors } from '../constants/design';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';
import { useClinicStore } from '../store/useClinicStore';
import { T } from '../constants/translations';
import { useTelegram } from '../hooks/useTelegram';
import { apiPost } from '../api/client';

// ── Мини-календарь ────────────────────────────────────────────────────────────

function MonthCalendar({
  selected,
  onChange,
  markedDates,
}: {
  selected: string;
  onChange: (d: string) => void;
  markedDates: Record<string, number>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initDate = new Date(selected || today);
  const [year, setYear] = useState(initDate.getFullYear());
  const [month, setMonth] = useState(initDate.getMonth());

  const { language } = useClinicStore();
  const t = T(language);
  const MONTHS = language === 'ru' 
    ? ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW = language === 'ru'
    ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
    : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ background: C.surface2, borderRadius: 16, padding: '10px 12px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, padding: '2px 6px' }}>◀</button>
        <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.text }}>{MONTHS[month]} {year}</span>
        <button onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, padding: '2px 6px' }}>▶</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {DOW.map((d, di) => (
          <div key={d} style={{
            fontFamily: F.sans, fontSize: 9, fontWeight: 600, textAlign: 'center',
            color: di === 6 ? '#ff4d4d' : C.muted,
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isSelected = iso === selected;
          const cnt = markedDates[iso] || 0;
          const isToday = iso === today;
          const isSunday = new Date(iso).getDay() === 0;

          return (
            <button
              key={iso}
              onClick={() => onChange(iso)}
              style={{
                padding: '4px 2px', borderRadius: 8,
                border: `1px solid ${isSelected ? C.accent : cnt > 0 ? C.border2 : 'transparent'}`,
                background: isSelected ? C.accent : cnt > 0 ? C.accentLt : 'transparent',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                transition: 'all .12s',
              }}
            >
              <span style={{
                fontFamily: F.mono, fontSize: 12,
                fontWeight: isSelected || isToday ? 700 : 400,
                color: isSelected ? '#fff' : isToday ? C.accent : isSunday ? '#ff4d4d' : C.text,
              }}>
                {d}
              </span>
              {cnt > 0 && !isSelected && (
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: C.cat }} />
              )}
              {cnt > 0 && isSelected && (
                <span style={{ fontFamily: F.mono, fontSize: 8, color: '#ffffffcc' }}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Страница ──────────────────────────────────────────────────────────────────

export function OperationsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selDay, setSelDay] = useState(today);
  const { patients, reorderPatients } = usePatientStore();
  const { openPatient } = useUIStore();
  const { language } = useClinicStore();
  const { tg, haptic } = useTelegram();
  const t = T(language);
  
  // Состояние для управления порядком
  const [movingId, setMovingId] = useState<string | null>(null);
  const [pressTimer, setPressTimer] = useState<any>(null);

  const handlePrint = async () => {
    if (!tg) return;
    haptic.impact('medium');
    tg.showConfirm(language === 'ru' ? 'Отправить расписание в Telegram?' : 'Send schedule to Telegram?', async (ok: boolean) => {
      if (!ok) return;
      try {
        const payload = {
          date: selDay,
          patients: dayPatients.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            eye: p.eye,
            iol: p.iolResult?.lens,
            power: (p.iolResult as any)?.[p.eye?.toLowerCase() === 'os' ? 'os' : 'od']?.selectedPower ?? (p.iolResult as any)?.power,
            status: p.status
          }))
        };
        await apiPost('/send_surgical_pdf', payload);
        tg.showAlert(language === 'ru' ? 'PDF отправлен!' : 'PDF Sent!');
      } catch (err: any) {
        tg.showAlert(`Error: ${err.message}`);
      }
    });
  };

  const fmtDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const M = language === 'ru'
      ? ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${+day} ${M[+m - 1]} ${y}`;
  };

  const markedDates = patients.reduce<Record<string, number>>((acc, p) => {
    if (p.date) acc[p.date] = (acc[p.date] || 0) + 1;
    return acc;
  }, {});

  // Сортируем по surgicalOrder (если нет — по ID для стабильности)
  const dayPatients = patients
    .filter(p => p.date === selDay)
    .sort((a, b) => (a.surgicalOrder ?? 999) - (b.surgicalOrder ?? 999) || String(a.id).localeCompare(String(b.id)));

  const handleMove = async (dir: 'up' | 'down', index: number) => {
    const list = [...dayPatients];
    const targetIdx = dir === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    // Своп
    const p1 = list[index];
    const p2 = list[targetIdx];
    
    // Присваиваем новые веса ( surgicalOrder: index )
    // Для простоты — просто пересчитываем всем в этом дне веса по текущим позициям
    list.forEach((p, idx) => {
      let finalOrder = idx;
      if (idx === index) finalOrder = targetIdx;
      else if (idx === targetIdx) finalOrder = index;
      reorderPatients(p.id, finalOrder);
    });
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', width: '100%', position: 'relative' }}>
      {/* Шапка (Календарь + Заголовок) - Сделаем её просто частью потока, если липкость ломает рендер */}
      <div style={{ background: C.bg, paddingBottom: 8 }}>
        {/* Календарь */}
        <div style={{ padding: '12px 16px 0' }}>
          <MonthCalendar selected={selDay} onChange={setSelDay} markedDates={markedDates} />
        </div>

        {/* Заголовок дня */}
        <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
               {fmtDate(selDay)}
            </div>
            {dayPatients.length > 0 && (
              <button
                onClick={handlePrint}
                style={{
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 20, padding: '4px 12px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: C.accent, fontFamily: F.sans, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
                {language === 'ru' ? 'ПЕЧАТЬ' : 'PRINT'}
              </button>
            )}
          </div>
          <span style={{
            background: C.accentLt, color: C.accent,
            fontFamily: F.mono, fontSize: 11, fontWeight: 700,
            padding: '4px 12px', borderRadius: 20, border: `1px solid ${C.accent}20`
          }}>
            {dayPatients.length} {language === 'ru' ? 'ПАЦИЕНТОВ' : 'PATIENTS'}
          </span>
        </div>
      </div>

      {/* Список операций */}
      <div style={{ padding: '8px 16px 120px', width: '100%' }}>
          {dayPatients.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
              {language === 'ru' ? 'На этот день операций не запланировано' : 'No operations scheduled for this day'}
            </div>
          )}
          {dayPatients.map((p, i) => {
            const tc = typeColors(p.type);
            const ec = eyeColors((p.eye?.toLowerCase() === 'os' ? 'os' : 'od'));
            const isMoving = movingId === p.id;

            const startPress = () => {
              const timer = setTimeout(() => {
                setMovingId(String(p.id));
                if (window.navigator?.vibrate) window.navigator.vibrate(50);
              }, 600);
              setPressTimer(timer);
            };

            const endPress = () => {
              if (pressTimer) clearTimeout(pressTimer);
            };

            return (
              <div key={p.id} style={{ display: 'block', width: '100%', marginBottom: 12 }}>
                <div
                  onPointerDown={startPress}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onClick={() => { if (!isMoving) openPatient(String(p.id), p.isEnhancement ? 'enhancement' : 'plan'); }}
                  style={{
                    background: isMoving ? C.surfaceActive : C.card,
                    border: `1px solid ${isMoving ? C.indigo : C.border}`,
                    borderRadius: R.lg, 
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                    transition: 'all .2s cubic-bezier(.16,1,.3,1)',
                    transform: isMoving ? 'scale(1.01)' : 'none',
                    boxShadow: isMoving ? `0 8px 32px ${C.indigoGlow}` : 'none',
                    position: 'relative',
                    zIndex: isMoving ? 10 : 1,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    minHeight: 68, padding: '12px 14px'
                  }}
                >
                  {isMoving && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); setMovingId(null); }}
                      style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: C.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 12 }}
                    >×</div>
                  )}

                  {/* Порядок / Кнопки движения */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    {isMoving && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleMove('up', i); }}
                         disabled={i === 0}
                         style={{ width: 32, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, opacity: i === 0 ? 0.2 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                       >▲</button>
                    )}
                    
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: tc.bg, border: `1px solid ${tc.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: tc.color,
                    }}>
                      {i + 1}
                    </div>

                    {isMoving && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleMove('down', i); }}
                         disabled={i === dayPatients.length - 1}
                         style={{ width: 32, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, opacity: i === dayPatients.length - 1 ? 0.2 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                       >▼</button>
                    )}
                  </div>

                  {/* Gender Indicator Bar (Unified) */}
                  <div style={{
                    width: 4, height: 26, borderRadius: 2, flexShrink: 0,
                    background: (p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F')) ? '#f472b6' : 
                                (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M')) ? C.od : C.border,
                    boxShadow: `0 0 10px ${(p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F')) ? '#f472b640' : 
                                (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M')) ? `${C.od}40` : 'transparent'}`
                  }} />

                  {/* Инфо */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <span style={{ 
                        fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.text, 
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
                      }}>{p.name}</span>
                      <span style={{
                        fontFamily: F.mono, fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 4,
                        background: (p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F')) ? '#f472b615' : 
                                    (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M')) ? `${C.od}15` : C.surface,
                        color: (p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F')) ? '#f472b6' : 
                               (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M')) ? C.od : C.tertiary,
                        border: `1px solid ${(p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F') || p.sex?.toUpperCase().startsWith('Ж')) ? '#f472b630' : 
                                    (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M') || p.sex?.toUpperCase().startsWith('М')) ? `${C.od}30` : C.border}`,
                        flexShrink: 0
                      }}>{(p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F') || p.sex?.toUpperCase().startsWith('Ж')) ? 'F' : 
                          (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M') || p.sex?.toUpperCase().startsWith('М')) ? 'M' : 'P'}</span>
                      {p.isEnhancement && (
                        <span style={{
                          fontSize: 8, fontWeight: 900, textTransform: 'uppercase', border: '1px solid rgba(236,72,153,.3)'
                        }}>{language === 'ru' ? 'ПОВТОР' : 'RE-SCAN'}</span>
                      )}
                    </div>
                    
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.tertiary, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ opacity: 0.6 }}>ID {p.id}</span>
                      <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
                      <span>{p.age || '—'}{t.years}</span>
                      <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
                      <span style={{ color: ec.color, fontWeight: 800 }}>{p.eye}</span>
                      {p.type === 'cataract' && (p.od?.al || p.os?.al) && (
                        <>
                          <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
                          <span style={{ color: C.cat }}>AL: {p.od?.al || p.os?.al} mm</span>
                        </>
                      )}
                    </div>

                    {/* IOL Details for Cataract */}
                    {p.type === 'cataract' && (
                      <div style={{ 
                        marginTop: 4, padding: '2px 8px', borderRadius: 6, 
                        background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}40`,
                        display: 'inline-flex', alignItems: 'center', gap: 6
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 800, color: C.tertiary, textTransform: 'uppercase' }}>{language === 'ru' ? 'ПЛАН:' : 'PLAN:'}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.cat }}>
                          {p.iolResult?.lens || (language === 'ru' ? 'ИОЛ не выбрана' : 'No IOL Selected')}
                        </span>
                        <div style={{ width: 1, height: 8, background: C.border, opacity: 0.3 }} />
                        <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 900, color: C.primary }}>
                          {(() => {
                            const eye = p.eye?.toLowerCase() === 'os' ? 'os' : 'od';
                            const pwr = p.iolResult?.[eye]?.selectedPower ?? (p.iolResult as any)?.power;
                            if (pwr === undefined || pwr === null || pwr === '—') return '0.0';
                            return typeof pwr === 'number' ? pwr.toFixed(2) : pwr;
                          })()} D
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Статус / Действие */}
                  {!isMoving && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <div style={{
                        background: tc.bg, color: tc.color, fontFamily: F.mono, fontSize: 9, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', border: `1px solid ${tc.color}40`,
                      }}>{p.type === 'cataract' ? t.cataract : t.refraction}</div>
                      
                      {p.status === 'done' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                           <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.success, boxShadow: `0 0 6px ${C.success}` }} />
                           <span style={{ fontFamily: F.mono, fontSize: 9, color: C.success, fontWeight: 700, opacity: 0.8 }}>{language === 'ru' ? 'ГОТОВО' : 'DONE'}</span>
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); openPatient(String(p.id), 'result'); }}
                          style={{
                            background: `linear-gradient(135deg, ${C.indigo} 0%, #3B82F6 100%)`,
                            color: '#fff', border: 'none',
                            fontFamily: F.sans, fontSize: 9, fontWeight: 900,
                            padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                            boxShadow: `0 4px 12px ${C.indigoDim}`, letterSpacing: '0.02em'
                          }}
                        >
                          {language === 'ru' ? 'РЕЗУЛЬТАТ' : 'OUTCOME'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
