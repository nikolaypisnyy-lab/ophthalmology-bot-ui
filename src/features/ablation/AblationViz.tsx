import React, { useEffect, useRef, useState, useMemo } from 'react';
import { C as globalC, F } from '../../constants/design';

export interface AblationPlanData {
  sph: number;
  cyl: number;
  axis: number;
  opticalZone: number;
  preOpPachymetry: number;
  trueAbl?: number;
  trueRSB?: number;
  kMean?: number;
}

// ── Colors & Theming ──────────────────────────────────────────────────────────
const C = {
  bg: globalC.surface2,
  cyan: '#00FFFF',
  red: globalC.red,
  orange: '#FF8C00',
  border: globalC.border,
  text: globalC.text,
  muted: globalC.muted,
  panel: globalC.surface3,
};

const JET = [
  { t: 0, c: [0, 0, 127] },
  { t: 0.125, c: [0, 0, 255] },
  { t: 0.375, c: [0, 255, 255] },
  { t: 0.625, c: [255, 255, 0] },
  { t: 0.875, c: [255, 0, 0] },
  { t: 1.0, c: [127, 0, 0] }
];

function getJetColor(v: number): [number, number, number, number] {
  if (v <= 0) return [...JET[0].c, 255] as any;
  if (v >= 1) return [...JET[JET.length - 1].c, 255] as any;
  let i = 0;
  while (v > JET[i + 1].t) i++;
  const c1 = JET[i];
  const c2 = JET[i + 1];
  const f = (v - c1.t) / (c2.t - c1.t);
  return [
    Math.round(c1.c[0] + (c2.c[0] - c1.c[0]) * f),
    Math.round(c1.c[1] + (c2.c[1] - c1.c[1]) * f),
    Math.round(c1.c[2] + (c2.c[2] - c1.c[2]) * f),
    255
  ];
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icons = {
  Refraction: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20L4 4M20 4L4 20" strokeDasharray="4 4" opacity="0.4" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Zones: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" strokeDasharray="2 2" />
      <path d="M2 12h20" />
      <path d="M6 9l-3 3 3 3M18 9l3 3-3 3" />
    </svg>
  ),
  Depth: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9c3 0 6 6 9 6s6-6 9-6" />
      <path d="M12 3v12" />
      <path d="M9 12l3 3 3-3" />
      <path d="M4 15h16" strokeDasharray="2 2" opacity="0.4" />
    </svg>
  ),
  Stroma: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="14" width="16" height="6" rx="1" fill="currentColor" fillOpacity="0.2" />
      <path d="M4 10h16M4 6h16" strokeDasharray="2 2" opacity="0.4" />
      <path d="M12 3v7" />
      <path d="M9 8l3 3 3-3" />
    </svg>
  ),
};

// ── Math ──────────────────────────────────────────────────────────────────────
function getAblationDepth(x: number, y: number, data: AblationPlanData): number {
  const { sph, cyl, axis, opticalZone: oz } = data;
  const radiusSq = x * x + y * y;
  const maxR2 = (oz / 2) * (oz / 2);
  
  if (radiusSq > maxR2) return 0;

  let dSph = 0;
  if (sph < 0) {
    dSph = (-sph * 4 / 3) * (maxR2 - radiusSq);
  } else if (sph > 0) {
    dSph = (sph * 4 / 3) * radiusSq;
  }

  let dCyl = 0;
  const radAxis = (axis * Math.PI) / 180;
  const yPrime = -x * Math.sin(radAxis) + y * Math.cos(radAxis);
  
  if (cyl < 0) {
    dCyl = (-cyl * 4 / 3) * (maxR2 - yPrime * yPrime);
  } else if (cyl > 0) {
    const xPrime = x * Math.cos(radAxis) + y * Math.sin(radAxis);
    dCyl = (cyl * 4 / 3) * (xPrime * xPrime);
  }
  
  // Применяем сглаживание к границе оптической зоны для цилиндра
  // Это убирает визуальную "ступеньку" (сдвиг линий) на горизонтальном профиле
  dCyl *= ((maxR2 - radiusSq) / maxR2);

  return Math.max(0, dSph + dCyl);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AblationViz({ data }: { data: AblationPlanData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animProgress, setAnimProgress] = useState(0);

  const transitionZone = 1.5; // Visual proxy based on mockup

  const { rawMaxDepth } = useMemo(() => {
    let m = 0;
    for(let r = 0; r <= data.opticalZone / 2; r += 0.1) {
      for(let a = 0; a < 360; a += 5) {
        const rad = a * Math.PI / 180;
        const d = getAblationDepth(r * Math.cos(rad), r * Math.sin(rad), data);
        if (d > m) m = d;
      }
    }
    return { rawMaxDepth: m };
  }, [data]);

  const displayMaxDepth = data.trueAbl ?? rawMaxDepth;
  
  const residual = data.trueRSB ?? (data.preOpPachymetry - displayMaxDepth);
  const isDanger = residual < 300;

  useEffect(() => {
    setAnimProgress(0);
    let start: number | null = null;
    const duration = 1200; 
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      const p = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setAnimProgress(p);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const PXPMM = w / 9; // Display 9mm total grid (-4.5 to +4.5)
    const imgData = ctx.createImageData(w, h);
    
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = (px - w / 2) / PXPMM;
        const y = -(py - h / 2) / PXPMM;
        const rSq = x*x + y*y;
        
        // Render out to 7.5mm diameter (radius 3.75) to give a dark blue edge
        if (rSq <= 3.75 * 3.75) {
          let depth = getAblationDepth(x, y, data) * animProgress;
          const t = depth / 120; // 120 is the max on the color scale
          const color = getJetColor(t);
          
          const i = (py * w + px) * 4;
          imgData.data[i] = color[0];
          imgData.data[i+1] = color[1];
          imgData.data[i+2] = color[2];
          imgData.data[i+3] = color[3];
          
          // Anti-alias the outer edge
          const rLimit = Math.sqrt(rSq);
          if (rLimit > 3.65) {
            imgData.data[i+3] = Math.floor(255 * (3.75 - rLimit) / 0.1);
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [data, animProgress]);

  // Вычисление сагиттальной высоты роговицы (на базе кривизны) для реалистичности профиля
  const cornealRadius = 337.5 / (data.kMean || 43.0);
  const sagittaMm = cornealRadius - Math.sqrt(cornealRadius * cornealRadius - 16); // срез 8мм (радиус 4)
  const curveHeight = sagittaMm * 25; // Визуальный масштаб

  const getBaseY = (px: number) => {
    const nx = px * 2 - 1; 
    return 10 + curveHeight * (nx * nx); 
  };

  const ProfileChart = ({ title, isVertical }: { title: string, isVertical: boolean }) => {
    let dPre = '';
    let maxD = 0;
    let maxX = 50; 
    let maxY = 10;
    
    for (let i = 0; i <= 100; i++) {
        const px = i / 100;
        const yBase = getBaseY(px);
        if (i === 0) dPre += `M 0 ${yBase}`;
        else dPre += ` L ${px * 100} ${yBase}`;
    }

    let dFill = dPre;
    let dPost = '';
    for (let i = 100; i >= 0; i--) {
        const px = i / 100;
        const mm = -4 + px * 8; 
        let depth = isVertical ? getAblationDepth(0, mm, data) : getAblationDepth(mm, 0, data);
        depth *= animProgress;
        
        // Более реалистичный визуальный множитель: при 150 мкм срез будет 15px от 30px купола.
        const yPost = getBaseY(px) + (depth / 150) * 15; 
        dFill += ` L ${px * 100} ${yPost}`;
        
        if (depth > maxD) {
            maxD = depth;
            maxX = px * 100;
            maxY = yPost;
        }

        if (i === 100) dPost += `M 100 ${yPost}`;
        else dPost += ` L ${px * 100} ${yPost}`;
    }
    dFill += " Z";

    return (
      <div style={{ flex: 1, position: 'relative', height: '100px' }}>
        <div style={{ fontSize: '11px', color: '#E2E8F0', paddingLeft: '4px', marginBottom: '8px' }}>{title}</div>
        <svg width="100%" height="80%" viewBox="0 0 100 60" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, padding: '0 8px' }}>
          {/* Fill */}
          <path d={dFill} fill="url(#orangeGlow)" opacity="0.6" />
          {/* Pre-op */}
          <path d={dPre} stroke="#64748B" strokeWidth="1" fill="none" />
          {/* Post-op */}
          <path d={dPost} stroke={C.cyan} strokeWidth="1.5" fill="none" style={{ filter: 'drop-shadow(0 0 3px #00FFFF)' }} />
          
          {/* Highlight Dot */}
          {maxD > 1 && (
            <circle cx={maxX} cy={maxY} r="2" fill="#FFF" stroke={C.orange} strokeWidth="0.5" style={{ filter: 'drop-shadow(0 0 4px #FFF)' }} />
          )}

          <defs>
            <linearGradient id="orangeGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1A2235" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  const SidebarRow = ({ label, value, unit }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '12px' }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontFamily: F.mono, color: C.text, fontWeight: 500 }}>
        {value} <span style={{ color: C.muted, fontSize: '10px' }}>{unit}</span>
      </span>
    </div>
  );

  return (
    <div style={{
      width: '100%', 
      background: C.bg, 
      fontFamily: F.sans,
      padding: '24px',
      borderRadius: '20px',
      border: `1px solid ${C.border}`,
      boxShadow: 'none',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '24px',
      color: C.text,
    }}>
      {/* ── HEADER (Full Width) ── */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: '12px' }}>
        <div style={{ fontSize: '15px', color: C.cyan, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          RefMaster: <span style={{ color: C.text, fontWeight: 400 }}>Ablation Planner</span>
        </div>
      </div>

      {/* ── LEFT COLUMN (Map + Profiles) ── */}
      <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ fontSize: '13px', color: '#E2E8F0', paddingLeft: '4px' }}>2D Ablation Map</div>
        
        {/* Heatmap Row */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', height: '240px' }}>
          
          <div style={{ position: 'relative', height: '100%', aspectRatio: '1/1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* Background Iris effect */}
            <svg width="150%" height="150%" viewBox="0 0 100 100" style={{ position: 'absolute', opacity: 0.1, left: '-25%', top: '-25%', pointerEvents: 'none' }}>
              {Array.from({length: 60}).map((_, i) => {
                  const angle = (i * 6) * Math.PI / 180;
                  const x1 = 50 + 15 * Math.cos(angle); const y1 = 50 + 15 * Math.sin(angle);
                  const x2 = 50 + 40 * Math.cos(angle + 0.1); const y2 = 50 + 40 * Math.sin(angle + 0.1);
                  return <path key={i} d={`M ${x1} ${y1} Q 50 50 ${x2} ${y2}`} stroke="#FFF" strokeWidth="0.3" fill="none" />
              })}
              <circle cx="50" cy="50" r="15" stroke="#FFF" strokeWidth="0.5" fill="none" />
              <circle cx="50" cy="50" r="42" stroke="#FFF" strokeWidth="0.5" fill="none" />
            </svg>

            {/* Canvas Base */}
            <canvas ref={canvasRef} width={240} height={240} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }} />

            {/* Overlays */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
              <circle cx="50%" cy="50%" r="48%" stroke={`${C.text}30`} strokeWidth="1" strokeDasharray="4 4" fill="none" />
              <circle cx="50%" cy="50%" r="35%" stroke={`${C.text}30`} strokeWidth="1" strokeDasharray="4 4" fill="none" />
              
              <line x1="50%" y1="2%" x2="50%" y2="98%" stroke={C.cyan} strokeWidth="1" />
              <line x1="2%" y1="50%" x2="98%" y2="50%" stroke={C.cyan} strokeWidth="1" />
              
              <text x="52%" y="65%" fill={C.text} fontSize="9" opacity="0.6">5.0</text>
              <text x="52%" y="80%" fill={C.text} fontSize="9" opacity="0.6">6.0</text>
              <text x="52%" y="88%" fill={C.text} fontSize="9" opacity="0.6">6.5</text>
              <text x="52%" y="96%" fill={C.text} fontSize="9" opacity="0.6">7.0</text>
            </svg>
          </div>

          {/* Colorbar Legend */}
          <div style={{ display: 'flex', alignItems: 'center', height: '80%', gap: '8px' }}>
            <div style={{ 
                width: 10, height: '100%', 
                background: 'linear-gradient(to top, #00007F, #0000FF, #00FFFF, #80FF80, #FFFF00, #FF3C00, #7F0000)',
                borderRadius: 5 
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontFamily: F.mono, fontSize: 10, color: C.text }}>
                <span>120</span><span>100</span><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span>
            </div>
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, color: C.text, opacity: 0.8, letterSpacing: '0.05em' }}>
                Ablation Depth (µm)
            </div>
          </div>
        </div>

        {/* Profiles Row */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
          <ProfileChart title="Horizontal Profile (0-180°)" isVertical={false} />
          <ProfileChart title="Vertical Profile (90-270°)" isVertical={true} />
        </div>
      </div>

      {/* ── RIGHT COLUMN (Sidebar Data) ── */}
      <div style={{ flex: '1 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '13px', color: C.cyan, marginBottom: '4px', letterSpacing: '0.05em' }}>Patient Ablation Data</div>
        
        {/* Card 1 */}
        <div style={{ background: C.panel, border: `1px solid ${C.cyan}40`, borderRadius: '12px', padding: '12px', boxShadow: `0 0 10px ${C.cyan}10 inset` }}>
           <div style={{ display: 'flex', gap: '12px' }}>
               <div style={{ color: C.cyan, padding: '4px' }}><Icons.Refraction /></div>
               <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Refraction Plan</div>
                  <SidebarRow label="Sph:" value={(data.sph>0?'+':'')+data.sph.toFixed(2)} unit="D" />
                  <SidebarRow label="Cyl:" value={(data.cyl>0?'+':'')+data.cyl.toFixed(2)} unit="D" />
                  <SidebarRow label="Axis:" value={data.axis} unit="°" />
               </div>
           </div>
        </div>

        {/* Card 2 */}
        <div style={{ background: C.panel, border: `1px solid ${C.cyan}40`, borderRadius: '12px', padding: '12px', boxShadow: `0 0 10px ${C.cyan}10 inset` }}>
           <div style={{ display: 'flex', gap: '12px' }}>
               <div style={{ color: C.cyan, padding: '4px' }}><Icons.Zones /></div>
               <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Treatment Zones</div>
                  <SidebarRow label="Optical Zone:" value={data.opticalZone.toFixed(1)} unit="mm" />
                  <SidebarRow label="Transition Zone:" value={transitionZone.toFixed(1)} unit="mm" />
               </div>
           </div>
        </div>

        {/* Card 3 */}
        <div style={{ background: C.panel, border: `1px solid ${C.cyan}40`, borderRadius: '12px', padding: '12px', boxShadow: `0 0 10px ${C.cyan}10 inset` }}>
           <div style={{ display: 'flex', gap: '12px' }}>
               <div style={{ color: C.cyan, padding: '4px' }}><Icons.Depth /></div>
               <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Depth Analysis</div>
                  <SidebarRow label="Max Depth:" value={displayMaxDepth.toFixed(1)} unit="µm" />
               </div>
           </div>
        </div>

        {/* Card 4 (Residual Stroma - Warning state) */}
        <div style={{ background: isDanger ? `${C.red}10` : C.panel, border: `1px solid ${isDanger ? C.red : C.cyan}40`, borderRadius: '12px', padding: '12px', boxShadow: isDanger ? `0 0 15px ${C.red}20 inset` : `0 0 10px ${C.cyan}10 inset` }}>
           <div style={{ display: 'flex', gap: '12px' }}>
               <div style={{ color: isDanger ? C.red : C.cyan, padding: '4px' }}><Icons.Stroma /></div>
               <div style={{ flex: 1 }}>
                  <div style={{ color: isDanger ? C.red : C.text, fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Residual Stroma</div>
                  <SidebarRow label="Post-op Residual:" value={residual.toFixed(1)} unit="µm" />
               </div>
           </div>
        </div>

      </div>

    </div>
  );
}
