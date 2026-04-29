import { useState, useRef } from 'react';
import { useClinicStore } from '../../store/useClinicStore';
import { useUIStore } from '../../store/useUIStore';
import { useSessionStore } from '../../store/useSessionStore';
import { eyeColors, C, F } from '../../constants/design';
import { runOCR } from '../../api/calculate';
import { T } from '../../constants/translations';
import { useTelegram } from '../../hooks/useTelegram';

function mapGeminiToFields(raw: Record<string, any>, targetType: string): Record<string, any> {
  const out: Record<string, any> = {};
  if (!raw) return out;
  out.name = raw.name || raw.patient_name || '';
  out.age = raw.age || raw.patient_age || null;
  out.sex = raw.sex || null;
  out.type = raw.type || targetType;
  const eyes = ['od', 'os'] as const;
  for (const eye of eyes) {
    const src = raw[eye];
    if (!src || typeof src !== 'object') continue;
    const entry: Record<string, any> = {};
    if (src.al !== undefined) entry.al = src.al;
    if (src.acd !== undefined) entry.acd = src.acd;
    if (src.lt !== undefined) entry.lt = src.lt;
    if (src.wtw !== undefined) entry.wtw = src.wtw;
    if (src.k1 !== undefined) entry.k1 = src.k1;
    if (src.k2 !== undefined) entry.k2 = src.k2;
    if (src.k1_ax !== undefined) entry.k1_ax = src.k1_ax;
    if (src.kavg !== undefined) entry.kavg = src.kavg;
    if (src.kercyl !== undefined) entry.kercyl = src.kercyl;
    if (src.cct !== undefined) entry.cct = src.cct;
    if (targetType !== 'cataract') {
      const mSph = src.man_sph ?? src.m_sph;
      const mCyl = src.man_cyl ?? src.m_cyl;
      const mAx = src.man_ax ?? src.m_ax;
      const mBcva = src.bcva ?? src.man_bcva ?? src.m_va;
      const mUva = src.uva ?? src.m_uva;
      if (mSph !== undefined && mSph !== null) entry.man_sph = mSph;
      if (mCyl !== undefined && mCyl !== null) entry.man_cyl = mCyl;
      if (mAx !== undefined && mAx !== null) entry.man_ax = mAx;
      if (mBcva !== undefined && mBcva !== null) entry.bcva = mBcva;
      if (mUva !== undefined && mUva !== null) entry.uva = mUva;
      if (src.c_sph !== undefined) entry.c_sph = src.c_sph;
      if (src.c_cyl !== undefined) entry.c_cyl = src.c_cyl;
      if (src.c_ax !== undefined) entry.c_ax = src.c_ax;
      if (src.n_sph !== undefined) entry.n_sph = src.n_sph;
      if (src.n_cyl !== undefined) entry.n_cyl = src.n_cyl;
      if (src.n_ax !== undefined) entry.n_ax = src.n_ax;
      if (src.p_ant_c !== undefined) entry.p_ant_c = src.p_ant_c;
      if (src.p_ant_a !== undefined) entry.p_ant_a = src.p_ant_a;
      if (src.p_post_c !== undefined) entry.p_post_c = src.p_post_c;
      if (src.p_post_a !== undefined) entry.p_post_a = src.p_post_a;
      if (src.p_tot_c !== undefined) entry.p_tot_c = src.p_tot_c;
      if (src.p_tot_a !== undefined) entry.p_tot_a = src.p_tot_a;
      if (src.al !== undefined) entry.al = src.al;
      if (src.plan_sph !== undefined) entry.plan_sph = src.plan_sph;
      if (src.plan_cyl !== undefined) entry.plan_cyl = src.plan_cyl;
      if (src.plan_ax !== undefined) entry.plan_ax = src.plan_ax;
    }
    if (Object.keys(entry).length > 0) out[eye] = entry;
  }
  
  // Handle flat structures where Gemini might not nest by eye
  if (!out.od && !out.os) {
    const entry: Record<string, any> = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (typeof v === 'number' || typeof v === 'string') entry[k] = v;
    });
    if (Object.keys(entry).length > 0) out.od = entry;
  }

  return out;
}

type Stage = 'idle' | 'scanning' | 'parsed' | 'done';

export function OCRModal() {
  const { ocrOpen, ocrSection, ocrOnResult, closeOCR, activeTab, activePeriod } = useUIStore();
  const { draft, setEyeField, setBioField, setDraft, setPeriodEyeField } = useSessionStore();
  const { language } = useClinicStore();
  const t = T(language);
  const { haptic } = useTelegram();

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
    const arr = Array.from(newFiles).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    setFiles(prev => [...prev, ...arr]);
    arr.forEach(f => setPreviews(prev => [...prev, URL.createObjectURL(f)]));
    haptic.selection();
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
    haptic.selection();
  };

  const reset = () => {
    files.forEach((_, i) => previews[i] && URL.revokeObjectURL(previews[i]));
    setFiles([]); setPreviews([]); setStage('idle'); setFields(null); setError(null);
  };

  const handleClose = () => { reset(); closeOCR(); };

  const scan = async () => {
    if (!files.length) return;
    haptic.medium();
    setStage('scanning'); setError(null); setProgress(0);
    progressTimer.current = setInterval(() => {
      setProgress(p => { if (p >= 85) { clearInterval(progressTimer.current!); return 85; } return p + Math.random() * 10; });
    }, 300);
    let target = ocrSection ?? 'all';
    if (activeTab === 'result') target = 'autoref';
    else if (draft?.type === 'cataract') target = 'biometry';
    try {
      const res = await runOCR(files, target);
      clearInterval(progressTimer.current!); setProgress(100);
      if (res.status !== 'ok' || !res.data) throw new Error(t.errorScanning);
      if (res.data && typeof res.data === 'object' && 'error' in res.data) throw new Error(`Gemini: ${(res.data as any).error}`);
      const mapped = mapGeminiToFields(res.data, draft?.type ?? 'refraction');
      if (Object.keys(mapped).filter(k => !['name','age','type','sex'].includes(k)).length === 0) throw new Error(t.errorNoDataFound);
      setFields(mapped); setStage('parsed'); haptic.notification('success');
    } catch (e: any) {
      clearInterval(progressTimer.current!); setProgress(0); setError(e.message ?? t.errorScanning); setStage('idle'); haptic.notification('error');
    }
  };

  const apply = () => {
    if (!fields) return;
    haptic.notification('success');
    if (ocrOnResult) { ocrOnResult(fields); setStage('done'); setTimeout(handleClose, 400); return; }
    if (!draft) { setError(t.errorNoSession); return; }
    if (activeTab !== 'result') { if (fields.name) setDraft({ name: fields.name }); if (fields.age) setDraft({ age: fields.age }); }
    if (activeTab === 'result') {
      for (const eye of ['od', 'os'] as const) {
        const s = (fields as any)[eye] ?? fields;
        if (!s || Object.keys(s).length === 0) continue;
        const sph = s.sph ?? s.n_sph ?? s.man_sph;
        const cyl = s.cyl ?? s.n_cyl ?? s.man_cyl;
        const ax = s.axis ?? s.ax ?? s.n_ax ?? s.man_ax;
        if (sph !== undefined) setPeriodEyeField(activePeriod, eye, 'sph', String(sph));
        if (cyl !== undefined) setPeriodEyeField(activePeriod, eye, 'cyl', String(cyl));
        if (ax !== undefined) setPeriodEyeField(activePeriod, eye, 'ax', String(ax));
        if (s.uva !== undefined || s.va !== undefined) setPeriodEyeField(activePeriod, eye, 'va', String(s.va ?? s.uva));
        if (s.bcva !== undefined) setPeriodEyeField(activePeriod, eye, 'bcva', String(s.bcva));
        if (s.k1 !== undefined) setPeriodEyeField(activePeriod, eye, 'k1', String(s.k1));
        if (s.k2 !== undefined) setPeriodEyeField(activePeriod, eye, 'k2', String(s.k2));
        const kax = s.k1_ax ?? s.k_ax;
        if (kax !== undefined) setPeriodEyeField(activePeriod, eye, 'k_ax', String(kax));
      }
    } else {
      for (const eye of ['od', 'os'] as const) {
        const raw = (fields as any)[eye];
        if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) continue;
        if (draft.type === 'cataract') {
          const bioMapping: Record<string, string> = { al: 'al', k1: 'k1', k2: 'k2', k1_ax: 'k1_ax', acd: 'acd', lt: 'lt', wtw: 'wtw', cct: 'cct', kavg: 'kavg' };
          Object.entries(bioMapping).forEach(([jsonKey, draftKey]) => { if (raw[jsonKey] !== undefined && raw[jsonKey] !== null) setBioField(eye, draftKey as any, String(raw[jsonKey])); });
        } else {
          const fieldRemap: Record<string, string> = { 
            k1_ax: 'kerax',
            p_sph: 'plan_sph',
            p_cyl: 'plan_cyl',
            p_ax: 'plan_ax'
          };
          const sectionAllowed: Record<string, Set<string>> = {
            manifest: new Set(['man_sph', 'man_cyl', 'man_ax', 'bcva', 'uva']),
            narrow: new Set(['n_sph', 'n_cyl', 'n_ax']),
            cyclo: new Set(['c_sph', 'c_cyl', 'c_ax', 'k1', 'k2', 'kavg', 'k1_ax']),
            keratometry: new Set(['k1', 'k2', 'kavg', 'k1_ax', 'al', 'cct', 'wtw']),
            pentacam: new Set(['p_ant_c', 'p_ant_a', 'p_post_c', 'p_post_a', 'p_tot_c', 'p_tot_a']),
            planned: new Set(['plan_sph', 'plan_cyl', 'plan_ax']),
          };
          const allowed = ocrSection && sectionAllowed[ocrSection] ? sectionAllowed[ocrSection] : null;
          const skipAlways = new Set(['al', 'acd', 'lt']);
          const { setPlanField } = useSessionStore.getState();
          Object.entries(raw).forEach(([k, v]) => {
            if (v === undefined || v === null || skipAlways.has(k)) return;
            const mappedKey = fieldRemap[k] ?? k;
            if (allowed && !allowed.has(mappedKey)) return;
            if (mappedKey.startsWith('plan_')) {
              const field = mappedKey.replace('plan_', '') as 'sph' | 'cyl' | 'ax';
              setPlanField(eye, field, parseFloat(String(v)) || 0);
            } else {
              setEyeField(eye, mappedKey, String(v));
            }
          });
        }
      }
    }
    setStage('done'); setTimeout(handleClose, 400);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', backdropFilter: 'blur(10px)' }} onClick={handleClose}>
      <div style={{ background: `linear-gradient(180deg, #111425 0%, #05060c 100%)`, borderRadius: '32px 32px 0 0', padding: '24px 20px calc(24px + env(safe-area-inset-bottom,0px))', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '90vh', overflowY: 'auto', borderTop: `1px solid ${C.border}`, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: F.sans, fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: '-0.01em' }}>OCR {t.scanning.toUpperCase()}</span>
          <button onClick={handleClose} style={{ width: 32, height: 32, borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, cursor: 'pointer', color: C.muted2, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />

        {files.length === 0 ? (
          <button onClick={() => inputRef.current?.click()} style={{ border: `2px dashed ${C.indigo}40`, borderRadius: 24, padding: '48px 20px', background: `${C.indigo}08`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, transition: 'all 0.2s' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${C.indigo}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke={C.indigo} strokeWidth="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" /><rect x="7" y="7" width="10" height="10" rx="1" /></svg></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 4 }}>{t.selectPhotoPdf}</div><div style={{ fontSize: 12, color: C.muted2, fontWeight: 700 }}>{t.multipleFilesHint}</div></div>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {previews.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}><img src={url} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} /><button onClick={() => removeFile(i)} style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: C.red, border: `2px solid ${C.bg}`, cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button></div>
            ))}
            <button onClick={() => inputRef.current?.click()} style={{ width: 84, height: 84, borderRadius: 16, border: `2px dashed ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.muted3, fontSize: 28, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
        )}

        {error && <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 16, padding: '12px 16px', fontSize: 12, color: C.red, fontWeight: 800 }}>{error}</div>}

        {stage === 'parsed' && fields && (
          <div className="su" style={{ background: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 24, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: `0 8px 32px ${C.green}15` }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.green, display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>{t.dataParsed.toUpperCase()}</div>
            <div style={{ fontSize: 14, color: C.text, display: 'flex', flexDirection: 'column', gap: 4 }}>{fields.name && <div>{t.patient}: <b>{fields.name}</b></div>}{fields.age && <div>{t.age}: <b>{fields.age}</b></div>}<div style={{ color: fields.type === 'cataract' ? C.indigo : C.indigo, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>{fields.type === 'cataract' ? t.cataract : t.refraction}</div></div>
            {(['od', 'os'] as const).map(eye => {
              const d = fields[eye]; if (!d || typeof d !== 'object' || Object.keys(d).length === 0) return null;
              const ec = eyeColors(eye);
              return (
                <div key={eye} style={{ padding: '12px 14px', background: `${C.surface}80`, borderRadius: 16, borderLeft: `4px solid ${ec.color}` }}>
                  <div style={{ color: ec.color, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', marginBottom: 8 }}>{eye.toUpperCase()} — {eye === 'od' ? t.rightEye : t.leftEye}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', fontFamily: F.mono, fontSize: 11, color: C.text }}>{Object.entries(d).slice(0,10).map(([k,v]:[any,any]) => <div key={k}>{k.toUpperCase()}: <b>{v}</b></div>)}</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          {stage === 'parsed' ? (
            <>
              <button onClick={reset} style={{ flex: 1, padding: '18px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface, fontSize: 15, fontWeight: 900, color: C.muted2, cursor: 'pointer' }}>{t.reset}</button>
              <button onClick={apply} style={{ flex: 2, padding: '18px', borderRadius: 20, border: 'none', background: `linear-gradient(135deg, ${C.green} 0%, #10B981 100%)`, fontSize: 15, fontWeight: 900, color: '#fff', cursor: 'pointer', boxShadow: `0 8px 24px ${C.green}40` }}>{t.applyData.toUpperCase()}</button>
            </>
          ) : (
            <button onClick={stage === 'scanning' ? undefined : (files.length ? scan : () => inputRef.current?.click())} disabled={stage === 'scanning'} style={{ flex: 1, padding: '18px', borderRadius: 20, border: 'none', background: stage === 'scanning' ? C.surface : `linear-gradient(135deg, ${C.indigo} 0%, #4338ca 100%)`, fontSize: 16, fontWeight: 900, color: stage === 'scanning' ? C.muted3 : '#fff', cursor: stage === 'scanning' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: stage === 'scanning' ? 'none' : `0 10px 24px ${C.indigo}40` }}>
              {stage === 'scanning' ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #fff3', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /><span>{t.scanning}... {Math.round(progress)}%</span></div>
                  <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}><div style={{ height: '100%', background: '#fff', width: `${progress}%`, transition: 'width 0.3s ease' }} /></div>
                </div>
              ) : files.length ? t.recognize.toUpperCase() : t.selectFile.toUpperCase()}
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
