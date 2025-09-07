'use client';

import { useEffect, useRef } from 'react';

export default function Starfield({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    if (!enabled) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const stars = Array.from({ length: 320 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random()*.8+.2 as number, t: Math.random()*1000 as number }));
    const resize = () => { const w = canvas.clientWidth; const h = canvas.clientHeight; canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr); (ctx as CanvasRenderingContext2D).imageSmoothingEnabled=false; };
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(canvas); } else { window.addEventListener('resize', resize); }
    resize();
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (const s of stars){
        s.t += 0.016 + s.z*0.014;
        const px = (s.x*canvas.width)|0; const py = ((s.y + Math.sin(s.t)*0.002)*canvas.height)|0; const size = (s.z*2 + (Math.sin(s.t*3)*0.5+0.5))|0; const bright = (160 + s.z*95)|0;
        ctx.fillStyle = `rgba(${bright},${bright},255,0.9)`;
        ctx.fillRect(px,py,size+1,size+1);
      }
      animRef.current=requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); };
  }, [enabled, dpr]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pixelated" aria-hidden/>;
}

