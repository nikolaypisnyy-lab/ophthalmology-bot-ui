import React, { useState } from 'react';
import { C, F, typeColors } from '../constants/design';
import { usePatientStore } from '../store/usePatientStore';
import { useUIStore } from '../store/useUIStore';

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

  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const DOW = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

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
  
  // Состояние для управления порядком
  const [movingId, setMovingId] = useState<string | null>(null);
  const [pressTimer, setPressTimer] = useState<any>(null);

  const fmtDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const M = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Шапка (Календарь + Заголовок) */}
      <div style={{ flexShrink: 0, background: C.bg, zIndex: 10 }}>
        {/* Календарь */}
        <div style={{ padding: '12px 16px 0' }}>
          <MonthCalendar selected={selDay} onChange={setSelDay} markedDates={markedDates} />
        </div>

        {/* Заголовок дня */}
        <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
             {fmtDate(selDay)}
          </div>
          <span style={{
            background: C.accentLt, color: C.accent,
            fontFamily: F.mono, fontSize: 11, fontWeight: 700,
            padding: '4px 12px', borderRadius: 20, border: `1px solid ${C.accent}20`
          }}>
            {dayPatients.length} ПАЦИЕНТОВ
          </span>
        </div>
      </div>

      {/* Список операций с абсолютным позиционированием */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ 
          position: 'absolute', inset: 0,
          overflowY: 'auto', 
          padding: '8px 16px 120px', 
          display: 'block', 
          WebkitOverflowScrolling: 'touch' 
        }}>
          {dayPatients.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
              Нет операций на этот день
            </div>
          )}
          {dayPatients.map((p, i) => {
            const tc = typeColors(p.type);
            const isMoving = movingId === p.id;

            const startPress = () => {
              const timer = setTimeout(() => {
                setMovingId(p.id);
                if (window.navigator?.vibrate) window.navigator.vibrate(50);
              }, 600);
              setPressTimer(timer);
            };

            const endPress = () => {
              if (pressTimer) clearTimeout(pressTimer);
            };

            return (
              <div key={p.id} style={{ display: 'block', width: '100%', marginBottom: 10 }}>
                <div
                  onPointerDown={startPress}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onClick={() => { if (!isMoving) openPatient(String(p.id), p.isEnhancement ? 'enhancement' : 'plan'); }}
                  style={{
                    background: isMoving ? C.surfaceActive : C.surface,
                    border: `1px solid ${isMoving ? C.accent : C.border}`,
                    borderRadius: 20, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                    transition: 'all .2s cubic-bezier(.16,1,.3,1)',
                    transform: isMoving ? 'scale(1.02)' : 'none',
                    boxShadow: isMoving ? `0 12px 30px ${C.accentGlow}` : 'none',
                    position: 'relative',
                    zIndex: isMoving ? 10 : 1,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    minHeight: 64, flexShrink: 0
                  }}
                >
                  {isMoving && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); setMovingId(null); }}
                      style={{ position: 'absolute', top: -10, right: -10, width: 24, height: 24, borderRadius: '50%', background: C.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                    >×</div>
                  )}

                  {/* Порядок / Кнопки движения */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    {isMoving && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleMove('up', i); }}
                         disabled={i === 0}
                         style={{ width: 34, height: 34, borderRadius: 10, background: C.surface3, border: `1px solid ${C.border}`, color: C.text, opacity: i === 0 ? 0.3 : 1 }}
                       >▲</button>
                    )}
                    
                    <div style={{
                      width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                      background: tc.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: tc.color,
                    }}>
                      {i + 1}
                    </div>

                    {isMoving && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleMove('down', i); }}
                         disabled={i === dayPatients.length - 1}
                         style={{ width: 34, height: 34, borderRadius: 10, background: C.surface3, border: `1px solid ${C.border}`, color: C.text, opacity: i === dayPatients.length - 1 ? 0.3 : 1 }}
                       >▼</button>
                    )}
                  </div>

                  {/* Инфо */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {p.isEnhancement && (
                        <span style={{
                          background: 'rgba(236,72,153,.15)', color: '#ec4899',
                          padding: '1px 6px', borderRadius: 6, flexShrink: 0,
                          fontSize: 9, fontWeight: 800, textTransform: 'uppercase'
                        }}>Re-scan</span>
                      )}
                    </div>
                    <div style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ opacity: 0.7 }}>{p.eye}</span>
                      <div style={{ width: 2, height: 2, borderRadius: '50%', background: C.border }} />
                      <span style={{ color: tc.color }}>{p.type === 'cataract' ? 'Катаракта' : 'Рефракция'}</span>
                    </div>
                  </div>

                  {/* Статус */}
                  {!isMoving && (
                    <div style={{ flexShrink: 0 }}>
                      {p.status === 'done' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontFamily: F.sans, fontSize: 12, fontWeight: 700 }}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                           ГОТОВО
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); openPatient(String(p.id), 'result'); }}
                          style={{
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                            color: '#fff', border: 'none',
                            fontFamily: F.sans, fontSize: 10, fontWeight: 800,
                            padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(22,163,74,0.3)'
                          }}
                        >
                          РЕЗУЛЬТАТ
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
    </div>
  );
}
