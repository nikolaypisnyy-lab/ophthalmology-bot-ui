import React, { useState, useEffect, useRef, useMemo } from 'react';
import { C, F } from '../constants/design';

interface WheelPickerProps {
  label: string;
  value: string;
  onClose: () => void;
  onConfirm: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const ITEM_H = 44;

export function WheelPicker({
  label,
  value,
  onClose,
  onConfirm,
  min = -25,
  max = 25,
  step = 0.5,
  unit = 'D',
}: WheelPickerProps) {
  const dec = step < 1 ? 2 : 0;

  const vals = useMemo(() => {
    const arr: number[] = [];
    for (
      let v = min;
      v <= max + 0.0001;
      v = Math.round((v + step) * 10000) / 10000
    ) {
      arr.push(v);
    }
    return arr;
  }, [min, max, step]);

  const fmt = (v: number) => {
    const n = parseFloat(String(v));
    if (isNaN(n)) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(dec);
  };

  const curIdx = useMemo(() => {
    const pf = parseFloat(value);
    if (isNaN(pf)) return Math.floor(vals.length / 2);
    let best = 0, bestD = Infinity;
    vals.forEach((v, i) => {
      const d = Math.abs(v - pf);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selIdx, setSelIdx] = useState(curIdx);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = curIdx * ITEM_H;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_H);
    setSelIdx(Math.max(0, Math.min(vals.length - 1, idx)));
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.72)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{ background: C.surface2, borderRadius: '20px 20px 0 0' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
          }}
        >
          <button
            onClick={onClose}
            style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Отмена
          </button>
          <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.text }}>
            {label} ({unit})
          </span>
          <button
            onClick={() => onConfirm(vals[selIdx])}
            style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Готово
          </button>
        </div>

        {/* Барабан */}
        <div style={{ position: 'relative', height: ITEM_H * 5, margin: '8px 16px' }}>
          {/* Подсветка выбранного */}
          <div style={{
            position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
            background: C.surface3, borderRadius: 10,
            pointerEvents: 'none', zIndex: 1,
          }} />
          {/* Верхний fade */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2,
            background: `linear-gradient(to bottom,${C.surface2},transparent)`,
            pointerEvents: 'none', zIndex: 2,
          }} />
          {/* Нижний fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
            background: `linear-gradient(to top,${C.surface2},transparent)`,
            pointerEvents: 'none', zIndex: 2,
          }} />

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              height: '100%',
              overflowY: 'scroll',
              scrollSnapType: 'y mandatory',
              paddingTop: ITEM_H * 2,
              paddingBottom: ITEM_H * 2,
              boxSizing: 'border-box',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              zIndex: 3,
            }}
          >
            {vals.map((v, i) => (
              <div
                key={i}
                style={{
                  height: ITEM_H,
                  scrollSnapAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setSelIdx(i);
                  scrollRef.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                }}
              >
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: i === selIdx ? 20 : 15,
                    fontWeight: i === selIdx ? 700 : 400,
                    color: i === selIdx ? C.text : C.muted,
                    transition: 'font-size .1s, color .1s',
                  }}
                >
                  {fmt(v)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Текущее значение */}
        <div
          style={{
            textAlign: 'center',
            fontFamily: F.mono,
            fontSize: 22,
            fontWeight: 700,
            color: C.accent,
            padding: '4px 0 calc(24px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {fmt(vals[selIdx])} {unit}
        </div>
      </div>
    </div>
  );
}
