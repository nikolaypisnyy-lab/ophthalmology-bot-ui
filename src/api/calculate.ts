import { apiPost, API_BASE, TELEGRAM_ID } from './client';
import type { IOLCalcResponse, IOLCalcRequest } from '../types/iol';

// ── Расчёт ИОЛ ───────────────────────────────────────────────────────────────

export async function calculateIOL(req: IOLCalcRequest): Promise<IOLCalcResponse> {
  return apiPost<IOLCalcResponse>('/calculate_iol', {
    data: {
      ...req,
      telegram_id: TELEGRAM_ID,
    }
  });
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OCRFile {
  name: string;
  data: string; // base64
  mime: string; // 'image/jpeg' | 'image/png' | 'application/pdf'
}

export interface OCRRequest {
  target: string; // 'refraction' | 'biometry' | 'all'
  files: OCRFile[];
}

export interface OCRResponse {
  status: 'ok' | 'error';
  data?: Record<string, unknown>;
  detail?: string;
}

/**
 * Конвертировать File в base64 OCRFile
 */
export async function fileToOCRFile(file: File): Promise<OCRFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({
        name: file.name,
        data: result.split(',')[1], // убираем data:...;base64, префикс
        mime: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

/**
 * Отправить файлы на OCR распознавание (Gemini).
 */
export async function runOCR(
  files: File[],
  target: string = 'all',
): Promise<OCRResponse> {
  const filePayloads = await Promise.all(files.map(fileToOCRFile));

  // OCR использует прямой fetch т.к. нужен особый URL
  const res = await fetch(`${API_BASE}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, files: filePayloads }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Ошибка сервера при распознавании');
  }

  return res.json();
}
