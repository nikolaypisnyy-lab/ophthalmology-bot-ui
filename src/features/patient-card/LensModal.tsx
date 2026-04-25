import React, { useState } from 'react';
import { C, F } from '../../constants/design';
import { useSessionStore } from '../../store/useSessionStore';
import { useTelegram } from '../../hooks/useTelegram';

interface IOLModel {
  id: string;
  brand: string;
  model: string;
  type: 'Monofocal' | 'Toric' | 'Multifocal' | 'EDOF';
  const: number;
}

const IOL_DATABASE: IOLModel[] = [
  { id: 'sn60wf', brand: 'Alcon', model: 'AcrySof IQ (SN60WF)', type: 'Monofocal', const: 119.1 },
  { id: 'clareon', brand: 'Alcon', model: 'Clareon (CNA0T0)', type: 'Monofocal', const: 119.4 },
  { id: 'zcb00', brand: 'J&J', model: 'Tecnis (ZCB00)', type: 'Monofocal', const: 119.3 },
  { id: 'eyhance', brand: 'J&J', model: 'Tecnis Eyhance (ICB00)', type: 'EDOF', const: 119.3 },
  { id: 'at_lisa', brand: 'Zeiss', model: 'AT LISA tri 839MP', type: 'Multifocal', const: 118.6 },
  { id: 'at_lara', brand: 'Zeiss', model: 'AT LARA 829MP', type: 'EDOF', const: 118.4 },
  { id: 'vivity', brand: 'Alcon', model: 'AcrySof IQ Vivity (DFT015)', type: 'EDOF', const: 119.2 },
  { id: 'panoptix', brand: 'Alcon', model: 'AcrySof IQ PanOptix (TFNT00)', type: 'Multifocal', const: 119.1 },
  { id: 'enavista', brand: 'Hoya', model: 'enVista (MX60E)', type: 'Monofocal', const: 119.1 },
];

interface LensModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LensModal({ isOpen, onClose }: LensModalProps) {
  const { haptic } = useTelegram();
  const { setDraft } = useSessionStore();
  const [search, setSearch] = useState('');
  const [activeBrand, setActiveBrand] = useState<string | null>(null);

  if (!isOpen) return null;

  const brands = Array.from(new Set(IOL_DATABASE.map(l => l.brand)));
  const filtered = IOL_DATABASE.filter(l => 
    (l.model.toLowerCase().includes(search.toLowerCase()) || l.brand.toLowerCase().includes(search.toLowerCase())) &&
    (!activeBrand || l.brand === activeBrand)
  );

  const handleSelect = (lens: IOLModel) => {
    haptic.success();
    const store = useSessionStore.getState();
    const currentDraft = store.draft;
    if (!currentDraft) return;

    // Обновляем iolResult внутри draft — это наш главный источник
    const updatedIOL = {
      ...(currentDraft.iolResult || {}),
      lens: lens.model,
      aConst: lens.const,
    } as any;

    store.setDraft({ iolResult: updatedIOL });
    
    // Также обновляем глобальный iolResult для синхронизации других вкладок
    store.setIOLResult(updatedIOL);
    
    onClose();
  };

  return (
    <div 
      style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div 
        style={{ background: C.surface, borderRadius: '32px 32px 0 0', padding: '24px 20px calc(24px + env(safe-area-inset-bottom,0px))', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 16, borderTop: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>Select IOL Model</span>
          <button onClick={onClose} style={{ background: C.surface2, border: 'none', borderRadius: '50%', width: 32, height: 32, color: C.muted3, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <input 
          placeholder="Search models..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 18px', color: C.text, fontFamily: F.sans, fontSize: 14, outline: 'none' }}
        />

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          <button 
            onClick={() => setActiveBrand(null)}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: !activeBrand ? C.indigo : C.card, color: !activeBrand ? '#fff' : C.muted2, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}
          >ALL BRANDS</button>
          {brands.map(b => (
            <button 
              key={b}
              onClick={() => setActiveBrand(b)}
              style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: activeBrand === b ? C.indigo : C.card, color: activeBrand === b ? '#fff' : C.muted2, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}
            >{b.toUpperCase()}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(l => (
            <button 
              key={l.id} 
              onClick={() => handleSelect(l)}
              style={{ 
                background: C.card, borderRadius: 18, padding: '16px', border: `1px solid ${C.border}`, 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                textAlign: 'left', width: '100%', outline: 'none', transition: 'all 0.2s'
              }}
              onPointerDown={(e) => { e.currentTarget.style.background = C.cardHi; }}
              onPointerUp={(e) => { e.currentTarget.style.background = C.card; }}
            >
              <div>
                <div style={{ fontSize: 8, fontWeight: 900, color: C.muted3, textTransform: 'uppercase', marginBottom: 4 }}>{l.brand}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{l.model}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.indigo, background: `${C.indigo}15`, padding: '2px 6px', borderRadius: 4 }}>{l.type.toUpperCase()}</span>
                  <span style={{ fontSize: 8, fontWeight: 900, color: C.amber, background: `${C.amber}15`, padding: '2px 6px', borderRadius: 4 }}>CONST: {l.const}</span>
                </div>
              </div>
              <div style={{ color: C.muted3, fontSize: 20 }}>›</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
