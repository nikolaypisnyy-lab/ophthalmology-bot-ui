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

// ── Хелпер: детали катарактального пациента ──────────────────────────────────
function buildCatDetails(p: any): { short: string; full: string } {
  const eye = (p.eye || 'OU').toUpperCase();
  const eyeKey = eye === 'OS' ? 'os' : 'od';

  const lens: string = p.iolResult?.lens || '';
  const pow = p.iolResult?.[eyeKey]?.selectedPower ?? p.iolResult?.power;
  const powStr = pow != null ? `${Number(pow).toFixed(2)} D` : '';

  const toric = p.toricResults?.[eyeKey];
  // Приоритет: явно выбранная модель → рекомендованная
  const toricModel: string = p.iolResult?.[eyeKey]?.selectedToricModel ?? toric?.best_model ?? '';
  const toricAxis = p.iolResult?.[eyeKey]?.toricAxis ?? toric?.total_steep_axis;
  const toricCyl = toric?.table?.find((r: any) => r.model === toricModel)?.cyl_iol
    ?? p.iolResult?.[eyeKey]?.toricCyl;

  if (toricModel) {
    // Формат: SN6AT 22.5D T3 +2.25D @163°
    const cylStr = toricCyl != null ? ` +${Number(toricCyl).toFixed(2)}D` : '';
    const axStr  = toricAxis != null ? ` @${Math.round(toricAxis)}°` : '';
    const short  = `${lens} ${powStr} ${toricModel}${cylStr}${axStr}`.trim();
    return { short, full: short };
  }

  const short = [lens, powStr].filter(Boolean).join(' ');
  return { short, full: short };
}

// ── Страница ──────────────────────────────────────────────────────────────────

function OperationItem({ 
  p, i, total, isMoving, handleMove, openPatient, language, t, savePatient,
  setMovingId, setPressTimer, pressTimer 
}: any) {
  const { haptic } = useTelegram();
  const [swiped, setSwiped] = useState(false);
  const [startX, setStartX] = useState(0);

  const tc = typeColors(p.type);
  const ec = eyeColors((p.eye?.toLowerCase() === 'os' ? 'os' : 'od'));

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

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.notification('success');
    // Remove from operations: clear date and set status to done (or undefined)
    await savePatient({ ...p, date: null, status: 'done' });
  };

  const startPress = () => {
    if (isMoving) return;
    const timer = setTimeout(() => {
      haptic.impact('heavy');
      setMovingId(String(p.id));
    }, 600);
    setPressTimer(timer);
  };

  const endPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  return (
    <div style={{ position: 'relative', background: C.red, borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
      {/* Remove Button Background */}
      <div 
        onClick={handleRemove}
        style={{
          position: 'absolute', top: 0, bottom: 0, right: 0, width: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: F.sans, fontSize: 11, fontWeight: 900,
          cursor: 'pointer', textTransform: 'uppercase'
        }}
      >
        {language === 'ru' ? 'УБРАТЬ' : 'REMOVE'}
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onClick={() => { if (!isMoving) openPatient(String(p.id), p.isEnhancement ? 'enhancement' : 'plan'); }}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 14,
          background: isMoving ? C.surfaceActive : C.card,
          padding: '12px 14px', borderRadius: 16,
          border: `1px solid ${isMoving ? C.indigo : C.border}`,
          transform: swiped ? 'translateX(-80px)' : 'translateX(0)',
          transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', minWidth: 32 }}>
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
               disabled={i === total - 1}
               style={{ width: 32, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, opacity: i === total - 1 ? 0.2 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
             >▼</button>
          )}
        </div>

        <div style={{
          width: 4, height: 26, borderRadius: 2, flexShrink: 0,
          background: (p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F')) ? '#f472b6' : 
                      (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M')) ? C.od : C.border,
          boxShadow: `0 0 10px ${(p.sex?.startsWith('Ж') || p.sex?.toUpperCase().startsWith('F')) ? '#f472b640' : 
                      (p.sex?.startsWith('М') || p.sex?.toUpperCase().startsWith('M')) ? `${C.od}40` : 'transparent'}`
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 6 }}>
                <div style={{
                  fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', 
                  border: '1px solid #ec4899', color: '#ec4899', 
                  padding: '3px 10px', borderRadius: 8, background: '#ec489908',
                  letterSpacing: '0.04em', lineHeight: 1
                }}>
                  {language === 'ru' ? 'ДОКОРРЕКЦИЯ' : 'ENHANCEMENT'}
                </div>
                <span style={{ 
                  fontSize: 6.5, fontWeight: 900, color: C.tertiary, 
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  opacity: 0.8
                }}>
                  {language === 'ru' ? 'БЕЗ ФЛЕПА' : 'NO FLAP'}
                </span>
              </div>
            )}
          </div>
          
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.tertiary, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ opacity: 0.6 }}>ID {p.id}</span>
            <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
            <span>{p.age || '—'}{t.years}</span>
            <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
            <span style={{ color: ec.color, fontWeight: 800 }}>{p.eye}</span>
            {p.isEnhancement && (() => {
              const enh = (p as any).savedEnhancement;
              const eyeKey = p.eye?.toLowerCase() === 'os' ? 'os' : 'od';
              const plan = enh?.[eyeKey];
              const s = parseFloat(String(plan?.sph ?? '0')) || 0;
              const c = parseFloat(String(plan?.cyl ?? '0')) || 0;
              const a = parseInt(String(plan?.ax ?? '0')) || 0;
              const fmt = (v: number) => (v > 0 ? '+' : '') + v.toFixed(2);
              return (
                <>
                  <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
                  <span style={{ color: '#ec4899', fontWeight: 700 }}>
                    {fmt(s)} / {c.toFixed(2)} × {a}°
                  </span>
                </>
              );
            })()}
            {p.type === 'cataract' && (p.od?.al || p.os?.al) && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: '50%', background: C.border2 }} />
                <span style={{ color: C.cat }}>AL: {p.od?.al || p.os?.al} mm</span>
              </>
            )}
          </div>

          {p.type === 'cataract' && (() => {
            const det = buildCatDetails(p);
            if (!det.short) return null;
            return (
              <div style={{
                marginTop: 4, padding: '3px 8px', borderRadius: 6,
                background: C.surface2, border: `1px solid ${C.border}40`,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: C.tertiary, textTransform: 'uppercase' }}>
                  {language === 'ru' ? 'ПЛАН:' : 'PLAN:'}
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.cat }}>
                  {det.short || (language === 'ru' ? 'ИОЛ не выбрана' : 'No IOL')}
                </span>
              </div>
            );
          })()}
        </div>

        {!isMoving && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <div style={{
              background: tc.bg, color: tc.color, fontFamily: F.mono, fontSize: 9, fontWeight: 700,
              padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', border: `1px solid ${tc.color}40`,
            }}>{p.type === 'cataract' ? t.cataract : t.refraction}</div>
            
            {p.status === 'done' && !p.isEnhancement ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                 <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.success, boxShadow: `0 0 6px ${C.success}` }} />
                 <span style={{ fontFamily: F.mono, fontSize: 9, color: C.success, fontWeight: 700, opacity: 0.8 }}>{language === 'ru' ? 'ГОТОВО' : 'DONE'}</span>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); openPatient(String(p.id), p.isEnhancement ? 'enhancement' : 'result'); }}
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
}

export function OperationsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selDay, setSelDay] = useState(today);
  const { patients, reorderPatients, savePatient } = usePatientStore();
  const { openPatient } = useUIStore();
  const { language, activeName } = useClinicStore();
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
          clinic_name: activeName || 'Clinic',
          date: selDay,
          patients: dayPatients.map((p) => {
            const eye = (p.eye || 'OU').toUpperCase();
            let details = '';
            if (p.type === 'cataract') {
              details = buildCatDetails(p).full || '—';
            } else {
              const isEnhancement = (p as any).isEnhancement;
              const plan = isEnhancement ? (p as any).savedEnhancement : (p as any).savedPlan;
              const odPlan = plan?.od;
              const osPlan = plan?.os;
              const flapDepth = (p as any).capOrFlap;
              const isPRK = (p as any).isPRK;
              const details_prefix = isEnhancement ? (language === 'ru' ? '[ДОКОРРЕКЦИЯ] ' : '[ENHANCEMENT] ') : '';
              const flapSuffix = isEnhancement ? (language === 'ru' ? ' [NO FLAP]' : ' [NO FLAP]') : (!isPRK && flapDepth ? ` flap ${flapDepth}µm` : '');
              const parts: string[] = [];
              const fmtPlan = (side: string, pl: any) => {
                const s = parseFloat(String(pl?.sph ?? '0')) || 0;
                const c = parseFloat(String(pl?.cyl ?? '0')) || 0;
                const a = parseInt(String(pl?.ax ?? '0')) || 0;
                return `${side}: ${s >= 0 ? '+' : ''}${s.toFixed(2)} ${c.toFixed(2)} x${a}°${flapSuffix}`;
              };
              if ((eye === 'OD' || eye === 'OU') && (odPlan || isEnhancement))
                parts.push(fmtPlan('OD', odPlan));
              if ((eye === 'OS' || eye === 'OU') && (osPlan || isEnhancement))
                parts.push(fmtPlan('OS', osPlan));
              details = details_prefix + parts.join('  ');
            }

            return {
              id: String(p.id),
              name: p.name || '—',
              age: p.age || '',
              sex: p.sex || '',
              eye,
              type: p.type,
              details: details || '—',
            };
          }),
        };
        await apiPost('/send_surgical_pdf', payload);
        tg.showAlert(language === 'ru' ? 'PDF отправлен в Telegram!' : 'PDF sent to Telegram!');
      } catch (err: any) {
        const msg = typeof err.message === 'string' ? err.message : 'Request failed';
        tg.showAlert(`Error: ${msg}`);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden' }}>
      {/* ФИКСИРОВАННЫЙ заголовок дня */}
      <div style={{ background: C.bg, paddingBottom: 8, borderBottom: `1px solid ${C.border}30`, zIndex: 100 }}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                {language === 'ru' ? 'ПЛАН' : 'PRINT'}
              </button>
            )}
          </div>
          <span style={{
            background: C.accentLt, color: C.accent,
            fontFamily: F.mono, fontSize: 11, fontWeight: 700,
            padding: '4px 12px', borderRadius: 20, border: `1px solid ${C.accent}20`
          }}>
            {dayPatients.length} {language === 'ru' ? 'ПАЦ' : 'PTS'}
          </span>
        </div>
      </div>

      {/* Список операций - СКРОЛЛИРУЕМЫЙ */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 120px' }}>
          {/* Календарь - теперь внутри скролла (скрывается при свайпе вверх) */}
          <div style={{ padding: '12px 0 20px', borderBottom: `1px solid ${C.border}20`, marginBottom: 12 }}>
            <MonthCalendar selected={selDay} onChange={setSelDay} markedDates={markedDates} />
          </div>

          {dayPatients.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: F.sans, fontSize: 14 }}>
              {language === 'ru' ? 'На этот день нет операций' : 'No operations today'}
            </div>
          )}
          
          <div style={{ padding: '4px 0px 100px' }}>
            {dayPatients.map((p, i) => (
              <OperationItem 
                key={p.id} 
                p={p} 
                i={i} 
                total={dayPatients.length}
                isMoving={movingId === p.id} 
                handleMove={handleMove}
                openPatient={openPatient}
                language={language}
                t={t}
                savePatient={savePatient}
                setMovingId={setMovingId}
                setPressTimer={setPressTimer}
                pressTimer={pressTimer}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
