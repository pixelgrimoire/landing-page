"use client";

import { useEffect, useRef } from 'react';

// Paletas de colores para las llamas y las chispas
const BLUE_FLAME_COLORS: [number, number, number][] = [
  [180, 220, 255], // #b4dcff - Cian muy claro
  [60, 150, 255],  // #3c96ff - Azul brillante
  [30, 80, 200],   // #1e50c8 - Azul profundo
];

const GOLD_SPARK_COLORS: [number, number, number][] = [
  [255, 240, 200], // #fff0c8 - Amarillo pálido
  [255, 220, 100], // #ffdc64 - Amarillo dorado
  [250, 180, 50],  // #fab432 - Naranja dorado
];

// Pequeño factor para que suban un poco más
const HEIGHT_BOOST = 1.2;


export default function BlueFlames({ enabled = true }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // Usamos refs para las variables que persisten entre renders
  const particleData = useRef({
    particles: [] as Particle[],
    running: true,
    pixelSize: 5,
    lastSpawn: 0,
  }).current;

  type Particle = {
    x: number; y: number;
    vx: number; vy: number;
    life: number; ttl: number;
    size: number;
    color: [number, number, number];
    type: 'flame' | 'spark';
  };

  useEffect(() => {
    if (!enabled) return;

    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    particleData.running = true;
    particleData.particles = [];

    const setSize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      particleData.particles = []; // Limpiar partículas al redimensionar
    };

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(setSize);
      ro.observe(host);
    } else {
      window.addEventListener('resize', setSize);
    }
    setSize();

    const spawnParticles = (now: number) => {
      if (now - particleData.lastSpawn < 50) return; // Limitar tasa de aparición
      particleData.lastSpawn = now;

      const w = canvas.width;
      const spawnX = w / 2;
      const spawnWidth = w * 0.3;

      // Generar partículas de llama
      for (let i = 0; i < 3; i++) {
        const type: 'flame' | 'spark' = Math.random() > 0.15 ? 'flame' : 'spark';
        const colorPalette = type === 'flame' ? BLUE_FLAME_COLORS : GOLD_SPARK_COLORS;

        const particle: Particle = {
          x: spawnX + (Math.random() - 0.5) * spawnWidth,
          y: canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -((Math.random() * 1.5 + 1.0) * HEIGHT_BOOST), // Velocidad ascendente ligeramente mayor
          life: 0,
          ttl: (Math.random() * 1.5 + 1.0) * HEIGHT_BOOST, // Vida un poco más larga
          size: particleData.pixelSize * (type === 'spark' ? (Math.random() * 0.5 + 0.75) : (Math.random() * 0.5 + 1)),
          color: colorPalette[Math.floor(Math.random() * colorPalette.length)],
          type: type,
        };
        particleData.particles.push(particle);
      }
    };

    const updateAndDrawParticles = (dt: number, now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = particleData.particles.length - 1; i >= 0; i--) {
        const p = particleData.particles[i];
        p.life += dt;

        if (p.life >= p.ttl) {
          particleData.particles.splice(i, 1);
          continue;
        }

        // Física suave
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy *= 0.995; // Desaceleración más suave para mantener altura
        p.vx += Math.sin(now * 0.001 + p.y * 0.1) * 0.05; // Vaivén mágico

        const alpha = 1.0 - (p.life / p.ttl);
        const [r, g, b] = p.color;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * alpha * 0.8})`;

        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    };

    let lastTime = performance.now();
    const loop = (now: number) => {
      if (!particleData.running) return;

      const dt = (now - lastTime) / 1000;
      lastTime = now;

      spawnParticles(now);
      updateAndDrawParticles(dt, now);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      particleData.running = false;
      cancelAnimationFrame(animFrameRef.current);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', setSize);
    };

  }, [enabled, particleData]);

  return (
      <div
        ref={hostRef}
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[300px] max-h-[260px] sm:max-w-[420px] sm:max-h-[350px] pointer-events-none z-20"
        aria-hidden
      >
        <canvas ref={canvasRef} className="w-full h-full opacity-90" />
      </div>
  );
}
