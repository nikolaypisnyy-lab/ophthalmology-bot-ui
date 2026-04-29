import { useEffect } from 'react';

const tg = typeof window !== 'undefined'
  ? (window as any).Telegram?.WebApp
  : null;

export function useTelegram() {
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();

      // disableVerticalSwipes is available since 7.7
      if (tg.isVersionAtLeast('7.7')) {
        try { tg.disableVerticalSwipes(); } catch (e) {}
      }

      // Повторный вызов через задержку для надежности на некоторых устройствах
      const t1 = setTimeout(() => tg.expand(), 500);
      const t2 = setTimeout(() => tg.expand(), 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, []);

  const haptic = {
    selection: () => tg?.HapticFeedback?.selectionChanged(),
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => tg?.HapticFeedback?.impactOccurred(style),
    notification: (type: 'error' | 'success' | 'warning') => tg?.HapticFeedback?.notificationOccurred(type),
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
