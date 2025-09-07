'use client';

import { useEffect, useState } from 'react';
import { makeRuneDataURL } from '@/lib/runes';
import type { CSSDxVars } from '@/lib/utils';

export default function RuneEmitter({ enabled = true }: { enabled?: boolean }) {
  type RuneItem = { id: string; top: number; left: number; dx: string; w: number; h: number; src: string; ttl: number };
  const [items, setItems] = useState<RuneItem[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const spawn = () => {
      const top = Math.random()*100;
      const left = Math.random()*100;
      const dx = (Math.random()*24 - 12).toFixed(1) + 'px';
      const scale = 3 + ((Math.random()*5)|0); // 3..7
      const { src, w, h } = makeRuneDataURL(scale);
      // Duración más corta para que no permanezcan mucho tiempo en pantalla
      const ttl = Math.floor(Math.random()*1200) + 1200; // 1200..2400ms
      const id = (globalThis.crypto as Crypto | undefined)?.randomUUID?.() || Math.random().toString(36).slice(2);
      // Mantener menos elementos en memoria/DOM
      setItems(p => [...p, { id, top, left, dx, w, h, src, ttl }].slice(-40));
    };
    // Bajar la tasa de aparición
    const it = setInterval(spawn, 280);
    return () => clearInterval(it);
  }, [enabled]);
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0">
      {items.map(r => {
        const style: CSSDxVars = { left: `${r.left}%`, top: `${r.top}%`, width: r.w, height: r.h, animationDuration: `${r.ttl}ms`, '--dx': r.dx } as CSSDxVars;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={r.id} src={r.src} alt="rune" className="rune-sprite rune-anim" style={style} />
        );
      })}
    </div>
  );
}
