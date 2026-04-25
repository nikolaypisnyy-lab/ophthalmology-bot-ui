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
    const s = n.toFixed(dec);
    const showPlus = (unit === 'D' || unit === 'dptr') && n > 0;
    return (showPlus ? '+' : '') + s;
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
        background: 'rgba(0,0,0,.85)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{ background: C.card, borderRadius: '24px 24px 0 0', borderTop: `1px solid ${C.border}`, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
          }}
        >
          <button
            onClick={onClose}
            style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.muted2, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            CANCEL
          </button>
          <span style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {label} {unit && `(${unit})`}
          </span>
          <button
            onClick={() => onConfirm(vals[selIdx])}
            style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 900, color: C.green, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            DONE
          </button>
        </div>

        {/* Wheel Drum */}
        <div style={{ position: 'relative', height: ITEM_H * 5, margin: '12px 20px' }}>
          {/* Highlight selection */}
          <div style={{
            position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
            background: 'rgba(255,255,255,0.03)', borderRadius: 12,
            border: `1px solid ${C.border}40`,
            pointerEvents: 'none', zIndex: 1,
          }} />
          
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2,
            background: `linear-gradient(to bottom, ${C.card}, transparent)`,
            pointerEvents: 'none', zIndex: 2,
          }} />
          
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
            background: `linear-gradient(to top, ${C.card}, transparent)`,
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
                    fontSize: i === selIdx ? 24 : 16,
                    fontWeight: i === selIdx ? 900 : 400,
                    color: i === selIdx ? C.text : C.muted3,
                    transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
                    letterSpacing: i === selIdx ? '0.05em' : '0',
                  }}
                >
                  {fmt(v)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected value display */}
        <div
          style={{
            textAlign: 'center',
            fontFamily: F.mono,
            fontSize: 26,
            fontWeight: 900,
            color: C.green,
            padding: '8px 0 calc(32px + env(safe-area-inset-bottom, 0px))',
            letterSpacing: '0.04em'
          }}
        >
          {fmt(vals[selIdx])} <span style={{ fontSize: 12, color: C.muted3 }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}
