import { useState, useRef } from 'react';
import { C, F } from '../../constants/design';
import { useUIStore } from '../../store/useUIStore';
import { useSessionStore } from '../../store/useSessionStore';
import { runOCR } from '../../api/calculate';

// ── Маппинг Gemini ответа в поля ─────────────────────────────────────────────

function mapGeminiToFields(
  raw: Record<string, any>,
  targetType: string,
): Record<string, any> {
  const out: Record<string, any> = {};
  if (!raw) return out;

  out.name = raw.name || raw.patient_name || '';
  out.age  = raw.age  || raw.patient_age  || null;
  out.sex  = raw.sex  || null;
  out.type = raw.type || targetType;

  const isCataract = targetType === 'cataract';
  const eyes = ['od', 'os'] as const;
  for (const eye of eyes) {
    const src = raw[eye];
    if (!src || typeof src !== 'object') continue;

    const entry: Record<string, any> = {};

    // Биометрия / Кератометрия — всегда
    if (src.al !== undefined)  entry.al = src.al;
    if (src.acd !== undefined) entry.acd = src.acd;
    if (src.lt !== undefined)  entry.lt = src.lt;
    if (src.wtw !== undefined) entry.wtw = src.wtw;
    if (src.k1 !== undefined)     entry.k1     = src.k1;
    if (src.k2 !== undefined)     entry.k2     = src.k2;
    if (src.k1_ax  !== undefined) entry.k1_ax  = src.k1_ax;
    if (src.kavg   !== undefined) entry.kavg   = src.kavg;
    if (src.kercyl !== undefined) entry.kercyl = src.kercyl;
    if (src.cct    !== undefined) entry.cct    = src.cct;

    if (!isCataract) {
      // Рефракция — только для ЛКЗ
      // API возвращает normalize_ocr_draft → поля man_sph/man_cyl/man_ax/uva/bcva
      const mSph  = src.man_sph  ?? src.m_sph;
      const mCyl  = src.man_cyl  ?? src.m_cyl;
      const mAx   = src.man_ax   ?? src.m_ax;
      const mBcva = src.bcva     ?? src.man_bcva ?? src.m_va;
      const mUva  = src.uva      ?? src.m_uva;
      if (mSph  !== undefined && mSph  !== null) entry.man_sph = mSph;
      if (mCyl  !== undefined && mCyl  !== null) entry.man_cyl = mCyl;
      if (mAx   !== undefined && mAx   !== null) entry.man_ax  = mAx;
      if (mBcva !== undefined && mBcva !== null) entry.bcva    = mBcva;
      if (mUva  !== undefined && mUva  !== null) entry.uva     = mUva;

      if (src.c_sph !== undefined) entry.c_sph = src.c_sph;
      if (src.c_cyl !== undefined) entry.c_cyl = src.c_cyl;
      if (src.c_ax  !== undefined) entry.c_ax = src.c_ax;

      if (src.n_sph !== undefined) entry.n_sph = src.n_sph;
      if (src.n_cyl !== undefined) entry.n_cyl = src.n_cyl;
      if (src.n_ax  !== undefined) entry.n_ax = src.n_ax;

      // Pentacam — только для ЛКЗ
      if (src.p_ant_c !== undefined) entry.p_ant_c = src.p_ant_c;
      if (src.p_ant_a !== undefined) entry.p_ant_a = src.p_ant_a;
      if (src.p_post_c !== undefined) entry.p_post_c = src.p_post_c;
      if (src.p_post_a !== undefined) entry.p_post_a = src.p_post_a;
      if (src.p_tot_c !== undefined) entry.p_tot_c = src.p_tot_c;
      if (src.p_tot_a !== undefined) entry.p_tot_a = src.p_tot_a;
    }

    if (Object.keys(entry).length > 0) {
      out[eye] = entry;
    }
  }

  return out;
}

// ── OCR Modal ─────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'scanning' | 'parsed' | 'done';

export function OCRModal() {
  const { ocrOpen, ocrSection, ocrOnResult, closeOCR, activeTab, activePeriod } = useUIStore();
  const { draft, setEyeField, setBioField, setDraft, setPeriodEyeField } = useSessionStore();

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>('idle');
  const [fields, setFields] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!ocrOpen) return null;

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf',
    );
    setFiles(prev => [...prev, ...arr]);
    arr.forEach(f => setPreviews(prev => [...prev, URL.createObjectURL(f)]));
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
  };

  const reset = () => {
    files.forEach((_, i) => previews[i] && URL.revokeObjectURL(previews[i]));
    setFiles([]); setPreviews([]);
    setStage('idle'); setFields(null); setError(null);
  };

  const handleClose = () => { reset(); closeOCR(); };

  const scan = async () => {
    if (!files.length) return;
    setStage('scanning'); setError(null); setProgress(0);

    progressTimer.current = setInterval(() => {
      setProgress(p => {
        if (p >= 85) { clearInterval(progressTimer.current!); return 85; }
        return p + Math.random() * 12;
      });
    }, 400);

    // Автоматический выбор цели в зависимости от типа пациента и вкладки
    let target = ocrSection ?? 'all';
    if (activeTab === 'result') {
      target = 'autoref';
    } else if (draft?.type === 'cataract') {
      target = 'biometry';
    } else if (target === 'all' && draft?.type === 'refraction') {
      // Для ЛКЗ по умолчанию пробуем найти всё, но если есть секция - она в приоритете
      target = 'all';
    }

    try {
      const res = await runOCR(files, target);
      clearInterval(progressTimer.current!);
      setProgress(100);
      if (res.status !== 'ok' || !res.data) throw new Error('Формат данных не опознан');
      // Gemini вернул ошибку — показываем её пользователю
      if (res.data && typeof res.data === 'object' && 'error' in res.data) {
        throw new Error(`Gemini: ${(res.data as any).error}`);
      }
      const d = draft;
      const mapped = mapGeminiToFields(res.data, d?.type ?? 'refraction');
      if (Object.keys(mapped).filter(k => !['name','age','type','sex'].includes(k)).length === 0)
        throw new Error('Данные не найдены в документе. Попробуйте другое фото.');
      setFields(mapped);
      setStage('parsed');
    } catch (e: any) {
      clearInterval(progressTimer.current!);
      setProgress(0);
      setError(e.message ?? 'Ошибка распознавания');
      setStage('idle');
    }
  };

  const apply = () => {
    if (!fields) return;

    // Если есть колбэк (например для нового пациента), вызываем его и выходим
    if (ocrOnResult) {
      ocrOnResult(fields);
      setStage('done');
      setTimeout(handleClose, 500);
      return;
    }

    if (!draft) { setError('Сессия не активна — откройте карту пациента'); return; }

    if (activeTab !== 'result') {
      // Тип пациента НЕ меняем — он задаётся при создании, не из OCR
      if (fields.name) setDraft({ name: fields.name });
      if (fields.age)  setDraft({ age: fields.age });
    }

    if (activeTab === 'result') {
      // Постоп (всегда автореф)
      for (const eye of ['od', 'os'] as const) {
        const s = (fields as any)[eye] ?? fields;
        if (!s || Object.keys(s).length === 0) continue;
        const sph = s.sph ?? s.n_sph ?? s.man_sph;
        const cyl = s.cyl ?? s.n_cyl ?? s.man_cyl;
        const ax  = s.axis ?? s.ax ?? s.n_ax ?? s.man_ax;
        if (sph !== undefined) setPeriodEyeField(activePeriod, eye, 'sph', String(sph));
        if (cyl !== undefined) setPeriodEyeField(activePeriod, eye, 'cyl', String(cyl));
        if (ax  !== undefined) setPeriodEyeField(activePeriod, eye, 'ax',  String(ax));
        if (s.uva  !== undefined || s.va  !== undefined) setPeriodEyeField(activePeriod, eye, 'va', String(s.va ?? s.uva));
        if (s.bcva !== undefined) setPeriodEyeField(activePeriod, eye, 'bcva', String(s.bcva));
        if (s.k1   !== undefined) setPeriodEyeField(activePeriod, eye, 'k1', String(s.k1));
        if (s.k2   !== undefined) setPeriodEyeField(activePeriod, eye, 'k2', String(s.k2));
        // k1_ax — имя поля из нормализатора; k_ax — legacy alias
        const kax = s.k1_ax ?? s.k_ax;
        if (kax !== undefined) setPeriodEyeField(activePeriod, eye, 'k_ax', String(kax));
      }
    } else {
      // Применяем данные по глазам
      for (const eye of ['od', 'os'] as const) {
        const raw = (fields as any)[eye];
        if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) continue;

        if (draft.type === 'cataract') {
          // Катаракта: биометрия → setBioField (bio_od/bio_os)
          const bioMapping: Record<string, string> = { al: 'al', k1: 'k1', k2: 'k2', k1_ax: 'k1_ax', acd: 'acd', lt: 'lt', wtw: 'wtw', cct: 'cct', kavg: 'kavg' };
          Object.entries(bioMapping).forEach(([jsonKey, draftKey]) => {
            if (raw[jsonKey] !== undefined && raw[jsonKey] !== null) {
              setBioField(eye, draftKey as any, String(raw[jsonKey]));
            }
          });
        } else {
          // Рефракция: всё через setEyeField (draft.od/os)
          // k1_ax из OCR → kerax (поле KER AX в форме рефракции)
          const fieldRemap: Record<string, string> = { k1_ax: 'kerax' };

          // Фильтр по выбранной секции
          const sectionAllowed: Record<string, Set<string>> = {
            manifest:    new Set(['man_sph', 'man_cyl', 'man_ax', 'bcva', 'uva']),
            narrow:      new Set(['n_sph', 'n_cyl', 'n_ax']),
            cyclo:       new Set(['c_sph', 'c_cyl', 'c_ax', 'k1', 'k2', 'kavg', 'k1_ax']),
            keratometry: new Set(['k1', 'k2', 'kavg', 'k1_ax']),
            pentacam:    new Set(['p_ant_c', 'p_ant_a', 'p_post_c', 'p_post_a', 'p_tot_c', 'p_tot_a']),
          };
          const allowed = ocrSection && sectionAllowed[ocrSection] ? sectionAllowed[ocrSection] : null;

          // Биометрические поля не применимы для формы рефракции
          const skipAlways = new Set(['al', 'acd', 'lt']);

          Object.entries(raw).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            if (skipAlways.has(k)) return;
            if (allowed && !allowed.has(k)) return;
            const destKey = fieldRemap[k] ?? k;
            setEyeField(eye, destKey, String(v));
          });
        }
      }
    }

    setStage('done');
    setTimeout(handleClose, 500);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: '#000000',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: C.surface2,
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(24px + env(safe-area-inset-bottom,0px))',
          display: 'flex', flexDirection: 'column', gap: 14,
          maxHeight: '85vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: F.sans, fontSize: 16, fontWeight: 700, color: C.text }}>
            OCR Распознавание
          </span>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 20 }}>×</button>
        </div>

        {/* Загрузка файлов */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
          onChange={e => addFiles(e.target.files)}
        />

        {files.length === 0 ? (
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${C.accent}40`,
              borderRadius: 16, padding: '32px 20px',
              background: C.accentLt, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}
          >
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke={C.accent} strokeWidth="1.5">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
            <span style={{ fontFamily: F.sans, fontSize: 14, color: C.accent, fontWeight: 600, textAlign: 'center' }}>
              Выбрать фото / PDF<br/><span style={{fontSize: 12, fontWeight: 400}}>можно выделить сразу несколько</span>
            </span>
            <span style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, textAlign: 'center' }}>
              Автореф, Pentacam, Выписки
            </span>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {previews.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img
                  src={url}
                  alt=""
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: `1px solid ${C.border}` }}
                />
                <button
                  onClick={() => removeFile(i)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 20, height: 20, borderRadius: '50%',
                    background: C.red, border: 'none', cursor: 'pointer',
                    color: '#fff', fontSize: 12, lineHeight: '20px', textAlign: 'center',
                  }}
                >×</button>
              </div>
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: 10,
                border: `2px dashed ${C.border2}`,
                background: 'transparent', cursor: 'pointer',
                color: C.muted, fontSize: 24,
              }}
            >+</button>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div style={{
            background: C.redLt, border: `1px solid ${C.red}40`,
            borderRadius: 10, padding: '10px 14px',
            fontFamily: F.sans, fontSize: 12, color: C.red,
          }}>
            {error}
          </div>
        )}

        {stage === 'parsed' && fields && (
          <div className="su" style={{
            background: C.surface3, border: `1px solid ${C.green}30`,
            borderRadius: 14, padding: '14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.green, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Данные распознаны
            </div>

            <div style={{ fontSize: 13, color: C.text, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {fields.name && <div>Пациент: <b>{fields.name}</b></div>}
              {fields.age && <div>Возраст: <b>{fields.age} лет</b></div>}
              <div style={{ color: fields.type === 'cataract' ? C.cat : C.ref, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                {fields.type === 'cataract' ? 'Биометрия / Катаракта' : 'ЛКЗ / Рефракция'}
              </div>
            </div>

            {(['od', 'os'] as const).map(eye => {
              const d = fields[eye];
              if (!d || typeof d !== 'object' || Object.keys(d).length === 0) return null;
              return (
                <div key={eye} style={{ padding: '8px 12px', background: C.surface, borderRadius: 10, borderLeft: `3px solid ${eye === 'od' ? C.od : C.os}` }}>
                  <div style={{ color: eye === 'od' ? C.od : C.os, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                    {eye === 'od' ? 'Правый глаз (OD)' : 'Левый глаз (OS)'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', fontFamily: F.mono, fontSize: 11, color: C.text }}>
                    {d.al && <div>AL: <b>{d.al}</b></div>}
                    {d.acd && <div>ACD: <b>{d.acd}</b></div>}
                    {d.k1 && <div>K1: <b>{d.k1}</b></div>}
                    {d.k2 && <div>K2: <b>{d.k2}</b></div>}
                    {d.k1_ax && <div>K-Ax: <b>{d.k1_ax}°</b></div>}
                    
                    {d.man_sph !== undefined && <div>M-Sph: <b>{d.man_sph}</b></div>}
                    {d.man_cyl !== undefined && <div>M-Cyl: <b>{d.man_cyl}</b></div>}
                    {d.man_ax  !== undefined && <div>M-Ax: <b>{d.man_ax}°</b></div>}
                    {d.man_bcva !== undefined && <div>M-VA: <b>{d.man_bcva}</b></div>}

                    {d.n_sph !== undefined && <div>N-Sph: <b>{d.n_sph}</b></div>}
                    {d.c_sph !== undefined && <div>C-Sph: <b>{d.c_sph}</b></div>}

                    {d.p_ant_c !== undefined && <div>P-Ant-C: <b>{d.p_ant_c}</b></div>}
                    {d.p_post_c !== undefined && <div>P-Post-C: <b>{d.p_post_c}</b></div>}
                    {d.p_tot_c !== undefined && <div>P-Tot-C: <b>{d.p_tot_c}</b></div>}
                    {d.cct !== undefined && <div>CCT: <b>{d.cct} um</b></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 10 }}>
          {stage === 'parsed' ? (
            <>
              <button
                onClick={reset}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: `1px solid ${C.border2}`, background: 'transparent',
                  fontFamily: F.sans, fontSize: 14, color: C.muted, cursor: 'pointer',
                }}
              >
                Заново
              </button>
              <button
                onClick={apply}
                style={{
                  flex: 2, padding: '12px', borderRadius: 12,
                  border: 'none', background: C.green,
                  fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
                }}
              >
                Применить данные
              </button>
            </>
          ) : (
            <button
              onClick={stage === 'scanning' ? undefined : (files.length ? scan : () => inputRef.current?.click())}
              disabled={stage === 'scanning'}
              style={{
                flex: 1, padding: '13px', borderRadius: 12,
                border: 'none',
                background: stage === 'scanning' ? C.surface3 : C.accent,
                fontFamily: F.sans, fontSize: 14, fontWeight: 700,
                color: stage === 'scanning' ? C.muted : '#fff',
                cursor: stage === 'scanning' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {stage === 'scanning' ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                    <span>Распознавание... {Math.round(Math.min(progress, 100))}%</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: C.accent,
                      width: `${Math.min(progress, 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              ) : files.length ? (
                'Распознать'
              ) : (
                'Выбрать файл'
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
