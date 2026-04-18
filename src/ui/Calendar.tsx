import React, { useState, useEffect } from 'react';
import { C, F } from '../constants/design';

interface CalendarProps {
  selectedDate: string | null;
  onSelect: (isoDate: string) => void;
}

export function Calendar({ selectedDate, onSelect }: CalendarProps) {
  const initDate = selectedDate ? new Date(selectedDate) : new Date();
  const [currentMonth, setCurrentMonth] = useState(initDate);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  
  // Shift to start week on Monday
  const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    // YYYY-MM-DD local format without UTC shift issues
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onSelect(`${year}-${m}-${d}`);
  };

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} style={{ height: 32 }} />);
  }

  const selectedTarget = selectedDate ? new Date(selectedDate) : null;
  const isTargetSameMonth = selectedTarget && selectedTarget.getFullYear() === year && selectedTarget.getMonth() === month;
  const today = new Date();
  const isTodaySameMonth = today.getFullYear() === year && today.getMonth() === month;

  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected = isTargetSameMonth && selectedTarget.getDate() === day;
    const isToday = isTodaySameMonth && today.getDate() === day;

    days.push(
      <button
        key={day}
        onClick={(e) => handleDayClick(day, e)}
        style={{
          height: 36,
          borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: F.mono, fontSize: 13, fontWeight: isSelected ? 800 : 500,
          background: isSelected ? C.accent : 'transparent',
          border: isToday && !isSelected ? `1px solid ${C.accent}40` : 'none',
          color: isSelected ? C.bg : (isToday ? C.accent : C.text),
          cursor: 'pointer',
          transition: 'all 0.2s',
          padding: 0
        }}
      >
        {day}
      </button>
    );
  }

  useEffect(() => {
    if (selectedDate) {
      const parsed = new Date(selectedDate);
      if (!isNaN(parsed.getTime())) {
        setCurrentMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
    }
  }, [selectedDate]);

  return (
    <div style={{
      background: C.surface3, border: `1px solid ${C.border}`,
      borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 16,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      marginTop: 8
    }}>
      {/* Шапка календаря */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
        <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {monthNames[month]} {year}
        </div>
        <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Дни недели */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: -8 }}>
        {dayNames.map(day => (
          <div key={day} style={{ textAlign: 'center', fontFamily: F.sans, fontSize: 10, fontWeight: 700, color: C.muted }}>
            {day}
          </div>
        ))}
      </div>

      {/* Сетка дней */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days}
      </div>
    </div>
  );
}
