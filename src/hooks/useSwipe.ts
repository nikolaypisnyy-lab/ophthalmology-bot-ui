import { useRef } from 'react';
import { useTelegram } from './useTelegram';

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 80 }: UseSwipeOptions) {
  const { haptic } = useTelegram();
  const startX = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(delta) < threshold) return;
    
    // Haptic feedback (Telegram priority, then Web API)
    if (haptic && typeof haptic.medium === 'function') {
        haptic.medium();
    } else if (navigator.vibrate) {
        navigator.vibrate(30);
    }
    
    if (delta < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  return { onTouchStart, onTouchEnd };
}
