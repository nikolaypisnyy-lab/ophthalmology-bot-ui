import { apiGet, apiPost, apiDelete, TELEGRAM_ID } from './client';
import type { PatientSummary, Patient } from '../types/patient';

// ── Список пациентов ──────────────────────────────────────────────────────────

export interface PatientsListResponse {
  status: 'ok' | 'error';
  patients?: PatientSummary[];
  detail?: string;
}

export async function getPatients(): Promise<PatientSummary[]> {
  const data = await apiGet<PatientsListResponse>('/patients');
  const patients = data.patients ?? [];
  
  // Мапим серверные поля на фронтенд-поля
  return patients
    .map((p: any) => ({
      ...p,
      id: String(p.id || p.patient_id || ''),
      type: p.type || p.patient_type || 'refraction',
      date: p.op_date || p.date, 
      isEnhancement: p.isEnhancement, 
    }))
    .filter((p: any) => p.id && p.id !== 'undefined') as PatientSummary[];
}

// ── Один пациент (с измерениями) ─────────────────────────────────────────────

export interface PatientDetailResponse {
  status: 'ok' | 'error';
  patient?: {
    patient_id: string | number;
    name: string;
    age: string | number;
    sex?: string;
    op_eye?: string;
    op_date?: string;
    patient_type?: string;
    od?: any;
    os?: any;
  };
  visit?: {
    visit_id: string | number;
  };
  detail?: string;
}

export async function getPatient(id: string): Promise<PatientDetailResponse> {
  return apiGet<PatientDetailResponse>(`/patients/${id}`);
}

// ── Создать пациента ──────────────────────────────────────────────────────────

export interface CreatePatientRequest {
  name: string;
  age: string | number;
  sex?: string;
  patient_type?: 'refraction' | 'cataract';
  op_eye?: string;
  op_date?: string;
  isEnhancement?: boolean;
  flapDiam?: string;
  capOrFlap?: string;
  od?: any;
  os?: any;
}

export interface CreatePatientResponse {
  status: 'ok' | 'error';
  patient_id?: string | number;
  visit_id?: string | number;
  detail?: string;
}

export async function createPatient(
  req: CreatePatientRequest,
): Promise<CreatePatientResponse> {
  return apiPost<CreatePatientResponse>('/patients', req);
}

// ── Обновить пациента ─────────────────────────────────────────────────────────

export interface UpdatePatientRequest {
  age?: string | number;
  sex?: string;
  name?: string;
  phone?: string;
  op_date?: string;
  op_eye?: string;
  patient_type?: 'refraction' | 'cataract';
  isEnhancement?: boolean;
  surgical_order?: number;
  flapDiam?: string;
  capOrFlap?: string;
  od?: any;
  os?: any;
}

export async function updatePatient(
  id: string,
  req: UpdatePatientRequest,
): Promise<{ status: string }> {
  return apiPost<{ status: string }>(`/patients/${id}`, req);
}

// ── Удалить пациента ──────────────────────────────────────────────────────────

export async function deletePatient(
  id: string,
): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`/patients/${id}`);
}

// ── Хелпер: сохранить пациента (create or update) ─────────────────────────────
// Возвращает { patient_id, visit_id } после операции

export interface SaveResult {
  patientId: string;
  visitId: string | null;
}

export async function savePatientMeta(patient: Partial<Patient>): Promise<SaveResult> {
  const isNew = !patient.id || String(patient.id).startsWith('local_');

  if (isNew) {
    // Новый пациент
    const res = await createPatient({
      name: patient.name ?? '',
      age: patient.age ?? '',
      sex: patient.sex,
      patient_type: patient.type,
      op_eye: patient.eye,
      op_date: patient.date,
      isEnhancement: patient.isEnhancement,
      flapDiam: (patient as any).flapDiam,
      capOrFlap: (patient as any).capOrFlap,
      od: patient.od,
      os: patient.os,
    });
    const patientId = String(res.patient_id ?? '');

    // Получаем visit_id (он создается автоматически при createPatient в api.py)
    if (patientId) {
      const detail = await getPatient(patientId);
      return {
        patientId,
        visitId: detail.visit?.visit_id ? String(detail.visit.visit_id) : null,
      };
    }
    return { patientId, visitId: null };
  } else {
    // Обновляем существующего
    await updatePatient(String(patient.id), {
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      op_date: patient.date,
      op_eye: patient.eye,
      patient_type: patient.type,
      isEnhancement: patient.isEnhancement,
      flapDiam: (patient as any).flapDiam,
      capOrFlap: (patient as any).capOrFlap,
      od: patient.od,
      os: patient.os,
    });
    return { patientId: String(patient.id), visitId: null };
  }
}
