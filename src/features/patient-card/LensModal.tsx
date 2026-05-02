import React, { useState } from 'react';
import { C, F } from '../../constants/design';
import { useSessionStore } from '../../store/useSessionStore';
import { useTelegram } from '../../hooks/useTelegram';
import { IOL_DB } from '../../constants/iol-db';

interface IOLModel {
  id: string;
  brand: string;
  model: string;
  type: 'Monofocal' | 'Toric' | 'Multifocal' | 'EDOF';
  const: number;
}

function extractBrand(name: string): string {
  if (name.startsWith('Alcon') || name.startsWith('AcrySof')) return 'Alcon';
  if (name.startsWith('B+L') || name.startsWith('Bausch')) return 'B+L';
  if (name.startsWith('J&J') || name.startsWith('J+J') || name.startsWith('Sensar')) return 'J&J';
  if (name.startsWith('Hoya')) return 'Hoya';
  if (name.startsWith('Zeiss')) return 'Zeiss';
  if (name.startsWith('Rayner')) return 'Rayner';
  if (name.startsWith('SIFI')) return 'SIFI';
  if (name.startsWith('HumanOptics')) return 'HumanOptics';
  if (name.startsWith('AST')) return 'AST';
  if (name.startsWith('Lenstec')) return 'Lenstec';
  if (name.startsWith('Ophtec')) return 'Ophtec';
  return name.split(' ')[0];
}

function detectType(name: string): 'Monofocal' | 'Toric' | 'Multifocal' | 'EDOF' {
  const n = name.toLowerCase();
  if (n.includes('toric') || n.includes('zct') || n.includes('sn6at') || n.includes('snd1t') || n.includes('sv25t')) return 'Toric';
  if (n.includes('panoptix') || n.includes('tfnt') || n.includes('lisa') || n.includes('trifocal') || n.includes('triv')) return 'Multifocal';
  if (n.includes('vivity') || n.includes('dft') || n.includes('lara') || n.includes('emv') || n.includes('eyhance') || n.includes('well') || n.includes('envy') || n.includes('diu') || n.includes('aspire')) return 'EDOF';
  return 'Monofocal';
}

const IOL_DATABASE: IOLModel[] = IOL_DB
  .filter(l => l.name !== 'Personal Constant')
  .map(l => ({
    id: l.name.replace(/[\s().+&/]/g, '_').toLowerCase(),
    brand: extractBrand(l.name),
    model: l.name,
    type: detectType(l.name),
    const: l.a_kane || l.a || 119.0,
  }));

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
