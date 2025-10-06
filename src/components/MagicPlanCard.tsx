'use client';

import { useEffect, useRef, useState, type CSSProperties as ReactCSSProperties } from 'react';
import type { Plan } from '@/lib/constants';
import type { CSSGlowVars } from '@/lib/utils';

export default function MagicPlanCard({ plan, yearly, onSubscribeAction }: { plan: Plan; yearly: boolean; onSubscribeAction: (p: Plan) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [runes, setRunes] = useState<{ id:number; x:number; y:number; ch:string; rot:number }[]>([]);
  const [spangles, setSpangles] = useState<{ id:number; x:number; y:number; ch:string; dx:number; dy:number; fdur:number; fdel:number; tdel:number }[]>([]);

  useEffect(()=>{
    const count = 8; const symbols = ['✧','⦿','⚝','⚜','✴','⚹','⦾','✦'];
    const rs = Array.from({length:count}).map((_,i)=>{ const ang = (i/count)*Math.PI*2; const r=36 + (i%3)*6; return { id:i, x:50 + Math.cos(ang)*r, y:50 + Math.sin(ang)*r, ch:symbols[i%symbols.length], rot:Math.random()*360 } });
    setRunes(rs);
    // Extra pequeñas estrellitas repartidas en el card para ambos lados
    const minis = Array.from({length:10}).map((_,i)=>{
      const x = 10 + Math.random()*80; // margen 10%
      const y = 12 + Math.random()*76;
      const glyphs = ['✦','✧','✶','✷','✳','❂','✱'];
      const dx = (Math.random()*10 - 5); // -5..5 px
      const dy = (Math.random()*8 - 4);
      const fdur = 6 + Math.random()*6; // 6-12s
      const fdel = Math.random()*4; // 0-4s
      const tdel = Math.random()*3; // 0-3s
      return { id: 1000+i, x, y, ch: glyphs[i%glyphs.length], dx, dy, fdur, fdel, tdel };
    });
    setSpangles(minis);
  },[]);

  useEffect(()=>{
    const el = ref.current; if(!el) return;
    const onMove = (e: PointerEvent)=>{
      const rect = el.getBoundingClientRect();
      const x=((e.clientX-rect.left)/rect.width)*100; const y=((e.clientY-rect.top)/rect.height)*100;
      el.style.setProperty('--mouse-x', x+"%"); el.style.setProperty('--mouse-y', y+"%");
      const max = (typeof window !== 'undefined' && window.innerWidth <= 640) ? 8 : 14; // softer on mobile
      const dx = ((x-50)/50) * max;
      const dy = ((y-50)/50) * max;
      el.style.setProperty('--parallax-x', dx.toFixed(2)+'px');
      el.style.setProperty('--parallax-y', dy.toFixed(2)+'px');
      el.classList.add('active');
    };
    const onLeave = ()=>{ el.classList.remove('active'); el.style.setProperty('--mouse-x','50%'); el.style.setProperty('--mouse-y','50%'); el.style.setProperty('--parallax-x','0px'); el.style.setProperty('--parallax-y','0px'); };
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave);
    return ()=>{ el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); };
  },[]);

  const priceM = plan.priceM; const priceY = plan.priceY;
  const cardStyle: CSSGlowVars = { '--glow': plan.color } as CSSGlowVars;
  const comingSoon = !!plan.comingSoon;
  const primaryCta = `Conjurar nivel ${plan.name}`;
  const secondaryCta = comingSoon
    ? 'Próximamente'
    : plan.id === 'apprentice'
    ? 'Prueba gratis 7 días'
    : plan.id === 'mage'
    ? 'Comenzar prueba 14 días'
    : 'Solicitar demo personalizada';
  const secondaryDisabled = comingSoon || plan.id === 'archmage';
  const saving = 'Ahorra 20% pagando anual';

  return (
    <div ref={ref} className={`glass magic-card z-30 ${yearly ? 'flipped' : ''}`} style={cardStyle}>
      <div className="magic-inner">
        <div className="magic-pane magic-front magic-skin pixel-border relative">
          {/* Decorative runes background */}
          <div className="pointer-events-none absolute inset-0 rune-layer">
            <div className="mag-circle"/>
            {runes.map(r => (
              <span key={r.id} className="rune pixel-font" style={{ left:`${r.x}%`, top:`${r.y}%`, transform:`translate(-50%,-50%) rotate(${r.rot}deg)` }}>{r.ch}</span>
            ))}
            {spangles.map(s => {
              type RuneVarStyle = ReactCSSProperties & { ['--dx']?: string; ['--dy']?: string; ['--fdur']?: string; ['--fdel']?: string; ['--tdel']?: string };
              const st: RuneVarStyle = { left:`${s.x}%`, top:`${s.y}%`, ['--dx']: `${s.dx}px`, ['--dy']: `${s.dy}px`, ['--fdur']: `${s.fdur}s`, ['--fdel']: `${s.fdel}s`, ['--tdel']: `${s.tdel}s` };
              return (
                <span key={`s-f-${s.id}`} className="rune-mini-wrap" style={st}>
                  <span className="rune-mini pixel-font">{s.ch}</span>
                </span>
              );
            })}
          </div>
          <div className="w-full relative z-10">
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold smooth-font">{plan.name}</div>
              {comingSoon ? (
                <span className="text-[10px] px-2 py-1 rounded bg-white/15 text-white pixel-font">PRÓXIMAMENTE</span>
              ) : (
                plan.popular && <span className="text-[10px] px-2 py-1 rounded bg-yellow-400 text-black pixel-font">Más popular</span>
              )}
            </div>
            {/* Subtítulo estilo Dock */}
            <div className="text-white/70 text-xs sm:text-sm smooth-font mt-1">
              {plan.id === 'apprentice' && 'Perfecto para 1 solución'}
              {plan.id === 'mage' && 'Para negocios en crecimiento'}
              {plan.id === 'archmage' && 'Todas las apps + funciones avanzadas'}
            </div>
            <div className="mt-3 text-3xl text-white font-extrabold smooth-font">${priceM}<span className="text-base text-white/60"> USD/mes</span></div>
            {/* Lista con checks como Dock */}
            <ul className="mt-4 space-y-2 text-white/85 text-sm smooth-font">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[2px] shrink-0">
                    <path d="M20 7L9 18l-5-5" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 w-full">
              <button
                className={`w-full px-4 py-2 rounded-md bg-gradient-to-b from-yellow-400 to-yellow-500 text-black font-semibold pixel-font text-xs ${comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={comingSoon}
                onClick={(e)=>{ e.stopPropagation(); if (!comingSoon) onSubscribeAction(plan); }}
              >{comingSoon ? 'Próximamente' : primaryCta}</button>
              {!comingSoon && (
                <button
                  className={`mt-3 w-full px-4 py-2 rounded-md border border-white/20 text-white/90 transition pixel-font text-xs ${secondaryDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/5'}`}
                  disabled={secondaryDisabled}
                  onClick={(e)=>{ e.stopPropagation(); }}
                >{secondaryCta}</button>
              )}
            </div>
          </div>
        </div>
        {/* Back pane: vista ANUAL */}
        <div className="magic-pane magic-back relative">
          <div className="pointer-events-none absolute inset-0 rune-layer">
            <div className="mag-circle"/>
            {runes.map(r => (
              <span key={r.id} className="rune pixel-font" style={{ left:`${r.x}%`, top:`${r.y}%`, transform:`translate(-50%,-50%) rotate(${r.rot}deg)` }}>{r.ch}</span>
            ))}
            {spangles.map(s => {
              type RuneVarStyle = ReactCSSProperties & { ['--dx']?: string; ['--dy']?: string; ['--fdur']?: string; ['--fdel']?: string; ['--tdel']?: string };
              const st: RuneVarStyle = { left:`${s.x}%`, top:`${s.y}%`, ['--dx']: `${s.dx}px`, ['--dy']: `${s.dy}px`, ['--fdur']: `${s.fdur}s`, ['--fdel']: `${s.fdel}s`, ['--tdel']: `${s.tdel}s` };
              return (
                <span key={`s-b-${s.id}`} className="rune-mini-wrap" style={st}>
                  <span className="rune-mini pixel-font">{s.ch}</span>
                </span>
              );
            })}
          </div>
          <div className="w-full relative z-10">
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold smooth-font">{plan.name}</div>
              {comingSoon ? (
                <span className="text-[10px] px-2 py-1 rounded bg-white/15 text-white pixel-font">PRÓXIMAMENTE</span>
              ) : (
                plan.popular && <span className="text-[10px] px-2 py-1 rounded bg-yellow-400 text-black pixel-font">Más popular</span>
              )}
            </div>
            <div className="text-white/70 text-xs sm:text-sm smooth-font mt-1">
              {plan.id === 'apprentice' && 'Perfecto para 1 solución'}
              {plan.id === 'mage' && 'Para negocios en crecimiento'}
              {plan.id === 'archmage' && 'Todas las apps + funciones avanzadas'}
            </div>
            <div className="mt-3 text-3xl text-white font-extrabold smooth-font">${priceY}<span className="text-base text-white/60"> USD/año</span></div>
            <div className="text-emerald-400 text-xs sm:text-sm mt-1 smooth-font">{saving}</div>
            <ul className="mt-4 space-y-2 text-white/85 text-sm smooth-font">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[2px] shrink-0">
                    <path d="M20 7L9 18l-5-5" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 w-full">
              <button
                className={`w-full px-4 py-2 rounded-md bg-gradient-to-b from-yellow-400 to-yellow-500 text-black font-semibold pixel-font text-xs ${comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={comingSoon}
                onClick={(e)=>{ e.stopPropagation(); if (!comingSoon) onSubscribeAction(plan); }}
              >{comingSoon ? 'Próximamente' : primaryCta}</button>
              {!comingSoon && (
                <button
                  className={`mt-3 w-full px-4 py-2 rounded-md border border-white/20 text-white/90 transition pixel-font text-xs ${secondaryDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/5'}`}
                  disabled={secondaryDisabled}
                  onClick={(e)=>{ e.stopPropagation(); }}
                >{secondaryCta}</button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="edge-glow"/>
    </div>
  );
}
