'use client';

import { useEffect, useState } from 'react';
import { clamp } from '@/lib/utils';

export default function CursorTrail({ enabled = true }: { enabled?: boolean }) {
  type Bit = { id: string; x: number; y: number; size: number; life: number };
  const [bits, setBits] = useState<Bit[]>([]);
  useEffect(() => {
    if (!enabled) return; let mounted=true;
    const onMove = (e: PointerEvent) => {
      const x=e.clientX, y=e.clientY; const n=1+((Math.random()*2)|0);
      const fresh = Array.from({length:n},()=>({ id: (globalThis.crypto as Crypto | undefined)?.randomUUID?.() || Math.random().toString(36).slice(2), x:x+(Math.random()*8-4), y:y+(Math.random()*8-4), size:4+((Math.random()*6)|0), life:900+((Math.random()*600)|0) }));
      setBits(p=>[...p,...fresh].slice(-90));
    };
    window.addEventListener('pointermove', onMove);
    const timer = setInterval(()=> mounted && setBits(p=>p.map(b=>({...b, life:b.life-60})).filter(b=>b.life>0)),60);
    return ()=>{ mounted=false; window.removeEventListener('pointermove', onMove); clearInterval(timer); };
  }, [enabled]);
  return <div className="pointer-events-none fixed inset-0 z-[60]">{bits.map(b=>(<div key={b.id} className="absolute pixelated" style={{left:b.x,top:b.y,width:b.size,height:b.size,transform:'translate(-50%, -50%)',background:`rgba(37,99,235,${clamp(b.life/900,0,1)})`,boxShadow:`0 0 12px rgba(37,99,235,${clamp(b.life/500,0,1)})`}}/>))}</div>;
}

