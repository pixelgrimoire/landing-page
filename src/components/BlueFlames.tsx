"use client";

import { useEffect, useRef } from 'react';

export default function BlueFlames({ enabled = true }: { enabled?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true })!;

    // Offscreen low-res buffer for pixelated look
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d', { alpha: true })!;

    let running = true;

    type Particle = { x:number; y:number; vx:number; vy:number; life:number; ttl:number; size:number; hue:number; sat:number; alpha:number };
    let particles: Particle[] = [];

    const config = {
      pixel: 5,
      maxParticles: 55,
      spawnRate: 5,
      baseHue: 205,
      hueJitter: 6,
      saturation: 76,
      lightness: 52,
      gravity: -3.2,
      drag: 0.998,
      spread: 0.08,
      swirl: 0.06,
      centerAttract: 0.05,   // atracción suave hacia el centro
      swayAmp: 0.06,         // % del ancho para vaivén lateral
      swaySpeed: 0.35        // Hz aprox
    } as const;

    const rand = (a:number, b:number) => a + Math.random()*(b-a);

    const setSize = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.floor(r.width * dpr));
      canvas.height = Math.max(2, Math.floor(r.height * dpr));
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';

      const scale = Math.max(1, Math.floor((r.width / config.pixel) / 64));
      off.width = Math.max(32, Math.floor(r.width / (config.pixel * scale)));
      off.height = Math.max(24, Math.floor(r.height / (config.pixel * scale)));

      particles = [];
    };

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(setSize);
      ro.observe(host);
    } else {
      window.addEventListener('resize', setSize);
    }
    setSize();

    const spawn = (dt:number, t:number) => {
      const toSpawn = Math.min(30, Math.floor(config.spawnRate * dt + Math.random()));
      const w = off.width;
      // línea central con vaivén
      const center = w * (0.5 + config.swayAmp * Math.sin(t * config.swaySpeed * 2*Math.PI));
      for (let i=0; i<toSpawn && particles.length < config.maxParticles; i++) {
        const x = center + rand(-w*config.spread*0.08, w*config.spread*0.08);
        const y = off.height - 2;
        const p: Particle = {
          x,
          y,
          vx: rand(-config.spread, config.spread) * 0.5,
          vy: rand(-1.1, -0.5),
          life: 0,
          ttl: rand(2.2, 3.8),
          size: Math.random() < 0.12 ? 3 : 2,
          hue: config.baseHue + rand(-config.hueJitter, config.hueJitter),
          sat: config.saturation,
          alpha: 1,
        };
        particles.push(p);
      }
    };

    let last = performance.now();
    const loop = () => {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tsec = now / 1000;

      spawn(dt, tsec);

      // update
      const w = off.width;
      const center = w * (0.5 + config.swayAmp * Math.sin(tsec * config.swaySpeed * 2*Math.PI));
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.ttl) { particles.splice(i,1); continue; }
        // Física
        p.vy += (config.gravity / 60) * dt;
        // atracción suave al centro
        const dx = (center - p.x);
        p.vx += (dx * config.centerAttract) * dt;
        // ligero mecido
        p.vx += Math.sin((now*0.0012) + i*0.13) * config.swirl * dt;
        p.vx *= config.drag; p.vy *= config.drag;
        p.x += p.vx; p.y += p.vy;
        // desvanecer
        p.alpha = Math.max(0, 1 - p.life / p.ttl);
      }

      // render offscreen
      offCtx.clearRect(0,0,off.width, off.height);
      offCtx.globalCompositeOperation = 'source-over';

      for (let i=0; i<particles.length; i++) {
        const p = particles[i];
        // realzar núcleo cian cerca del centro
        const d = Math.abs(p.x - center) / (w*0.08 + 1e-6);
        const core = Math.max(0, 1 - d); // 0..1
        const hue = p.hue - core * 8; // más cian en el núcleo
        const l = Math.max(44, Math.min(72, config.lightness + core * 10));
        offCtx.globalAlpha = Math.pow(p.alpha, 1.7) * (0.9 + 0.1*core);
        offCtx.fillStyle = `hsl(${hue} ${p.sat}% ${l}%)`;
        const x = Math.floor(p.x);
        const y = Math.floor(p.y);
        const s = p.size;
        offCtx.fillRect(x, y, s, s);
        // chispas muy esporádicas
        if (Math.random() < 0.002) {
          offCtx.fillRect(x + (Math.random()<0.5?-1:1), y-1, 1, 1);
        }
      }

      // upscale al canvas visible sin suavizado
      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.88;
      ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, canvas.width, canvas.height);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', setSize);
      if (host.contains(canvas)) host.removeChild(canvas);
    };
  }, [enabled]);

  return (
    <div ref={hostRef} className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[380px] h-[300px] pointer-events-none mix-blend-screen z-10" aria-hidden />
  );
}
