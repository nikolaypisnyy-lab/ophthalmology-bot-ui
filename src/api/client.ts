// ── Конфигурация ──────────────────────────────────────────────────────────────

const urlParams = new URLSearchParams(
  typeof window !== 'undefined' ? window.location.search : '',
);

export const API_BASE: string = (() => {
  if (urlParams.get('api')) return urlParams.get('api')!;
  if (typeof window === 'undefined') return '/api';
  
  // Гарантируем полный путь, чтобы избежать проблем с относительными URL в TMA
  const origin = window.location.origin;
  return origin.includes('localhost') ? '/api' : (origin + '/api');
})();

// Telegram WebApp ID (fallback — dev ID)
const tg = typeof window !== 'undefined'
  ? (window as any).Telegram?.WebApp
  : null;

export const TELEGRAM_ID: string =
  tg?.initDataUnsafe?.user?.id
    ? String(tg.initDataUnsafe.user.id)
    : '379286602';

export let ACTIVE_CLINIC_ID: string | null = null;

export function setActiveClinicId(id: string | null) {
  ACTIVE_CLINIC_ID = id;
}

// ── Базовые методы ────────────────────────────────────────────────────────────

/** Общие заголовки для всех запросов */
function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  const currentTg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
  const currentId = currentTg?.initDataUnsafe?.user?.id ? String(currentTg.initDataUnsafe.user.id) : TELEGRAM_ID;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'telegram-id': currentId,
    ...extra,
  };

  if (ACTIVE_CLINIC_ID) {
    headers['clinic-id'] = ACTIVE_CLINIC_ID;
  }

  return headers;
}

/** Обработка ответа — бросает Error если статус != 2xx */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

/** GET запрос */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: baseHeaders(),
  });
  return handleResponse<T>(res);
}

/** POST запрос */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/** DELETE запрос */
export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  return handleResponse<T>(res);
}
