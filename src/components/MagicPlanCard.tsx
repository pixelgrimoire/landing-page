'use client';

import { useEffect, useRef, useState } from 'react';
import type { Plan } from '@/lib/constants';
import type { CSSGlowVars } from '@/lib/utils';

export default function MagicPlanCard({ plan, yearly, onSubscribeAction }: { plan: Plan; yearly: boolean; onSubscribeAction: (p: Plan) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [runes, setRunes] = useState<{ id:number; x:number; y:number; ch:string; rot:number }[]>([]);

  useEffect(()=>{
    const count = 8; const symbols = ['✧','⦿','⚝','⚜','✴','⚹','⦾','✦'];
    const rs = Array.from({length:count}).map((_,i)=>{ const ang = (i/count)*Math.PI*2; const r=36 + (i%3)*6; return { id:i, x:50 + Math.cos(ang)*r, y:50 + Math.sin(ang)*r, ch:symbols[i%symbols.length], rot:Math.random()*360 } });
    setRunes(rs);
  },[]);

  useEffect(()=>{
    const el = ref.current; if(!el) return;
    const onMove = (e: PointerEvent)=>{ const rect = el.getBoundingClientRect(); const x=((e.clientX-rect.left)/rect.width)*100; const y=((e.clientY-rect.top)/rect.height)*100; el.style.setProperty('--mouse-x', x+"%"); el.style.setProperty('--mouse-y', y+"%"); el.classList.add('active'); };
    const onLeave = ()=>{ el.classList.remove('active'); el.style.setProperty('--mouse-x','50%'); el.style.setProperty('--mouse-y','50%'); };
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave);
    return ()=>{ el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); };
  },[]);

  const price = yearly ? plan.priceY : plan.priceM; const suffix = yearly ? '/año' : '/mes';
  const cardStyle: CSSGlowVars = { '--glow': plan.color } as CSSGlowVars;
  const comingSoon = !!plan.comingSoon;

  return (
    <div ref={ref} className={`glass magic-card z-30 ${flipped ? 'flipped' : ''}`} style={cardStyle} onClick={(e: React.MouseEvent<HTMLDivElement>)=>{ const isBtn = (e.target as HTMLElement).closest('button'); if(!isBtn) setFlipped(v=>!v); }}>
      <div className="magic-inner">
        <div className="magic-pane magic-front pixel-border">
          <div className="w-full">
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold smooth-font">{plan.name}</div>
              {comingSoon ? (
                <span className="text-[10px] px-2 py-1 rounded bg-white/15 text-white pixel-font">PRÓXIMAMENTE</span>
              ) : (
                plan.popular && <span className="text-[10px] px-2 py-1 rounded bg-yellow-400 text-black pixel-font">POPULAR</span>
              )}
            </div>
            <div className="mt-3 text-3xl text-white font-extrabold smooth-font">${price}<span className="text-base text-white/60"> USD{suffix}</span></div>
            <ul className="mt-4 space-y-2 text-white/75 text-sm smooth-font">
              {plan.features.map(f=> <li key={f}>• {f}</li>)}
            </ul>
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-2 items-stretch w-full">
              <button
                className={`w-full px-4 py-2 rounded-md bg-gradient-to-b from-yellow-400 to-yellow-500 text-black font-semibold pixel-font text-xs ${comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={comingSoon}
                onClick={(e)=>{ e.stopPropagation(); if (!comingSoon) onSubscribeAction(plan); }}
              >{comingSoon ? 'Próximamente' : 'Suscribirme'}</button>
              <button className="w-full px-4 py-2 rounded-md border border-white/20 text-white/90 hover:bg-white/5 transition pixel-font text-xs" onClick={(e)=>{ e.stopPropagation(); setFlipped(true); }}>Descubrir</button>
            </div>
          </div>
        </div>
        <div className="magic-pane magic-back">
          <div className="mag-circle"/>
          {runes.map(r => (
            <span key={r.id} className="rune pixel-font" style={{ left:`${r.x}%`, top:`${r.y}%`, transform:`translate(-50%,-50%) rotate(${r.rot}deg)` }}>{r.ch}</span>
          ))}
          <div className="text-center px-6">
            <div className="text-2xl mb-2" aria-hidden>🪄</div>
            <h3 className="secret-title text-xl font-bold smooth-font bg-clip-text text-transparent" style={{backgroundImage:'linear-gradient(45deg,#fff,var(--glow))'}}>Arcana {plan.name}</h3>
            <p className="text-white/85 mt-2 text-sm smooth-font">El círculo invoca perks ocultos y un aura de soporte aumentado. Haz clic para volver o suscríbete para sellar el pacto.</p>
            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-2 items-stretch w-full max-w-sm mx-auto">
              <button
                className={`w-full px-4 py-2 rounded-md bg-gradient-to-b from-yellow-400 to-yellow-500 text-black font-semibold pixel-font text-xs ${comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={comingSoon}
                onClick={(e)=>{ e.stopPropagation(); if (!comingSoon) onSubscribeAction(plan); }}
              >{comingSoon ? 'Próximamente' : 'Suscribirme'}</button>
              <button className="w-full px-4 py-2 rounded-md border border-white/20 text-white/90 hover:bg-white/5 transition pixel-font text-xs" onClick={(e)=>{ e.stopPropagation(); setFlipped(false); }}>Volver</button>
            </div>
          </div>
        </div>
      </div>
      <div className="edge-glow"/>
    </div>
  );
}
