import type { Patient, PatientSummary } from './patient';

// ── Patients ─────────────────────────────────────────────────────────────────

export interface GetPatientsResponse {
  status: 'ok' | 'error';
  data?: PatientSummary[];
  detail?: string;
}

export interface GetPatientResponse {
  status: 'ok' | 'error';
  data?: Patient;
  detail?: string;
}

export interface SavePatientRequest {
  telegram_id: string;
  patient: Partial<Patient>;
}

export interface SavePatientResponse {
  status: 'ok' | 'error';
  data?: { id: string };
  detail?: string;
}

export interface DeletePatientResponse {
  status: 'ok' | 'error';
  detail?: string;
}

// ── Measurements ─────────────────────────────────────────────────────────────

export interface GetMeasurementsResponse {
  status: 'ok' | 'error';
  data?: Record<string, unknown>;
  detail?: string;
}

export interface SaveMeasurementsRequest {
  telegram_id: string;
  measurements: Record<string, unknown>;
}

export interface SaveMeasurementsResponse {
  status: 'ok' | 'error';
  detail?: string;
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OCRRequest {
  target: string;
  files: Array<{ name: string; data: string; mime: string }>;
}

export interface OCRResponse {
  status: 'ok' | 'error';
  data?: Record<string, unknown>;
  detail?: string;
}
