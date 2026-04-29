import React, { useRef } from 'react';

export const AutoRepeatButton = ({ onTrigger, children, style }: any) => {
  const timerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  const start = (e: any) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target && e.target.setPointerCapture && e.pointerId !== undefined) {
      try { e.target.setPointerCapture(e.pointerId); } catch(err){}
    }
    onTrigger();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => { onTrigger(); }, 100);
    }, 400);
  };

  const stop = (e: any) => {
    if (e && e.target && e.target.releasePointerCapture && e.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch(err){}
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <button
      draggable="false"
      onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
      onTouchStart={(e) => {
        // iOS long-press menu suppression
        if (e.cancelable) e.preventDefault();
      }}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      style={{ 
        ...style, 
        userSelect: 'none', 
        WebkitUserSelect: 'none', 
        WebkitTouchCallout: 'none', 
        touchAction: 'manipulation' 
      }}
    >
      {children}
    </button>
  );
};
