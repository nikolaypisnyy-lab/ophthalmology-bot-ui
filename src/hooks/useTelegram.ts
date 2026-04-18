import { useEffect } from 'react';

const tg = typeof window !== 'undefined'
  ? (window as any).Telegram?.WebApp
  : null;

export function useTelegram() {
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      // Отключаем встроенный Telegram swipe-to-close — слишком чувствительный.
      // Вместо него используем свой обработчик с порогом 120px (см. App.tsx useSwipeToClose).
      try { tg.disableVerticalSwipes?.(); } catch {}
      // Повторный вызов через задержку для надежности на некоторых устройствах
      const t1 = setTimeout(() => tg.expand(), 500);
      const t2 = setTimeout(() => tg.expand(), 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, []);

  const haptic = {
    light:   () => tg?.HapticFeedback?.impactOccurred('light'),
    medium:  () => tg?.HapticFeedback?.impactOccurred('medium'),
    success: () => tg?.HapticFeedback?.notificationOccurred('success'),
    error:   () => tg?.HapticFeedback?.notificationOccurred('error'),
  };

  return {
    tg,
    haptic,
    userId: tg?.initDataUnsafe?.user?.id ?? null,
    colorScheme: tg?.colorScheme ?? 'dark',
  };
}
