import { apiPost, API_BASE, TELEGRAM_ID } from './client';
import type { BiometryData, IOLFormulaResult } from '../types/iol';

// ── Расчёт ИОЛ ───────────────────────────────────────────────────────────────

export interface IOLCalcRequest {
  name?: string;
  age?: string;
  sex?: string;
  const_a_barrett: number;
  const_a_kane: number;
  const_a_jnj?: number;
  use_barrett?: boolean;
  use_kane?: boolean;
  use_jnj?: boolean;
  use_kane_toric?: boolean;
  kane_sia?: number;
  kane_incision?: number;
  jnj_sia?: number;
  jnj_incision?: number;
  od?: { al: number; k1: number; k2: number; acd: number; k1_ax: number; target: number };
  os?: { al: number; k1: number; k2: number; acd: number; k1_ax: number; target: number };
}

export interface IOLCalcResponse {
  status: 'ok' | 'error';
  results?: {
    barrett?: { od?: IOLFormulaResult; os?: IOLFormulaResult };
    kane?: { od?: IOLFormulaResult; os?: IOLFormulaResult };
    jnj?: { od?: IOLFormulaResult; os?: IOLFormulaResult };
  };
  errors?: string[];
  detail?: string;
}

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
