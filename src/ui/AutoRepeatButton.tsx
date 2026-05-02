import React, { useRef } from 'react';

export const AutoRepeatButton = ({ onTrigger, children, style }: any) => {
  const timerRef    = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const isDownRef   = useRef(false);

  const clear = () => {
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  };

  const stop = () => {
    if (!isDownRef.current) return;
    isDownRef.current = false;
    clear();
    // Remove global safety listeners
    window.removeEventListener('pointerup',  stopGlobal);
    window.removeEventListener('touchend',   stopGlobal);
    window.removeEventListener('touchcancel', stopGlobal);
  };

  // Arrow fn so removeEventListener works on same reference
  const stopGlobal = () => stop();

  const start = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (isDownRef.current) return;
    isDownRef.current = true;

    onTrigger();

    // Global listeners to catch finger-up even if element loses focus
    window.addEventListener('pointerup',   stopGlobal, { once: true });
    window.addEventListener('touchend',    stopGlobal, { once: true });
    window.addEventListener('touchcancel', stopGlobal, { once: true });

    clear();
    timerRef.current = setTimeout(() => {
      if (!isDownRef.current) return;
      intervalRef.current = setInterval(() => {
        if (isDownRef.current) onTrigger();
        else clear();
      }, 80);
    }, 500); // 500ms задержка до авто-повтора
  };

  return (
    <button
      draggable="false"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onTouchStart={e => { if (e.cancelable) e.preventDefault(); }}
      onClick={e => { e.stopPropagation(); e.preventDefault(); }}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      style={{
        ...style,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none',
      }}
    >
      {children}
    </button>
  );
};
