import React from 'react';
import { C, F, R, eyeColors } from '../constants/design';

interface EyeToggleProps {
  value: 'od' | 'os';
  onChange: (eye: 'od' | 'os') => void;
  onLongPress?: (eye: 'od' | 'os') => void;
  disabledEyes?: ('od' | 'os')[];
  size?: 'sm' | 'md';
}

export function EyeToggle({ value, onChange, onLongPress, disabledEyes = [], size = 'md' }: EyeToggleProps) {
  const sm = size === 'sm';
  const [pressTimer, setPressTimer] = React.useState<any>(null);

  const startPress = (eye: 'od' | 'os') => {
    const timer = setTimeout(() => {
      onLongPress?.(eye);
      try {
        if ((window as any).Telegram?.WebApp?.HapticFeedback) {
          (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
      } catch(e) {}
      setPressTimer(null);
    }, 600);
    setPressTimer(timer);
  };

  const endPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: C.surface,
      borderRadius: 12,
      padding: 3,
      gap: 3,
      border: `1px solid ${C.border}`,
      width: '100%',
    }}>
      {(['od', 'os'] as const).map(eye => {
        const active = value === eye;
        const isDisabled = disabledEyes.includes(eye);
        const ec = eyeColors(eye);
        
        return (
          <button
            key={eye}
            onPointerDown={() => startPress(eye)}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            onPointerCancel={endPress}
            onContextMenu={e => e.preventDefault()}
            onClick={() => !isDisabled && onChange(eye)}
            style={{
              position: 'relative',
              background: active ? ec.bg : 'transparent',
              border: 'none',
              padding: sm ? '8px 0' : '10px 0',
              fontFamily: F.sans,
              fontSize: sm ? 11 : 12,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: active ? ec.color : (isDisabled ? C.muted3 : C.muted2),
              cursor: isDisabled ? 'default' : 'pointer',
              borderRadius: 9,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: isDisabled ? 0.4 : 1,
              WebkitTapHighlightColor: 'transparent',
              outline: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              touchAction: 'manipulation'
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: active ? ec.color : (isDisabled ? 'transparent' : C.muted2),
              opacity: active ? 1 : 0.3,
              transition: 'all 0.2s',
              border: isDisabled ? `1px solid ${C.muted3}` : 'none'
            }} />
            {eye.toUpperCase()}
            {isDisabled && (
               <div style={{
                  position: 'absolute', top: -3, right: -3,
                  background: C.bg, borderRadius: 6,
                  padding: '1px 3px', fontSize: 6, color: C.muted3,
                  border: `1px solid ${C.border}`, fontWeight: 900
               }}>
                  OFF
               </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
