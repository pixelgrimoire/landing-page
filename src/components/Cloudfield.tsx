'use client';

import { useEffect, useRef } from 'react';

type LayerConfig = {
  count: number;
  speedMultiplier: number;
  scaleMultiplier: number;
  alpha: number;
};

type Cloud = {
  x: number; // en unidades de grid (no píxeles físicos)
  y: number; // en unidades de grid (no píxeles físicos)
  speed: number; // unidades de grid por frame
  image: HTMLCanvasElement; // canvas temporal ya rasterizado en píxeles grandes
  widthInPixels: number; // ancho del canvas temporal en píxeles físicos
};

export default function Cloudfield({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    if (!enabled) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const c = canvas;
    const g = ctx;

    // --- Configuración ---
    const PIXEL_SIZE = 10;
    const LAYERS: readonly LayerConfig[] = [
      { count: 10, speedMultiplier: 0.5, scaleMultiplier: 0.6, alpha: 0.75 },
      { count: 7, speedMultiplier: 1.0, scaleMultiplier: 1.0, alpha: 1.0 },
    ];
    // ----------------------

    function drawPixel(targetCtx: CanvasRenderingContext2D, x: number, y: number, color: string) {
      targetCtx.fillStyle = color;
      targetCtx.fillRect(Math.floor(x) * PIXEL_SIZE, Math.floor(y) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }

    function drawPixelCircle(targetCtx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, color: string) {
      const rSquared = radius * radius;
      const intRadius = Math.ceil(radius);
      for (let x = centerX - intRadius; x <= centerX + intRadius; x++) {
        for (let y = centerY - intRadius; y <= centerY + intRadius; y++) {
          const dx = x - centerX;
          const dy = y - centerY;
          if (dx * dx + dy * dy <= rSquared) {
            drawPixel(targetCtx, x, y, color);
          }
        }
      }
    }

    function createCumulusCloud(layerConfig: LayerConfig): Cloud {
      const gridWidth = Math.ceil(c.width / PIXEL_SIZE);
      const gridHeight = Math.ceil(c.height / PIXEL_SIZE);

      const puffCount = 12 + Math.floor(Math.random() * 18);
      const puffs: { dx: number; dy: number; radius: number }[] = [];
      const mainRadius = (5 + Math.random() * 7) * layerConfig.scaleMultiplier;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      for (let i = 0; i < puffCount; i++) {
        const angle = Math.random() * Math.PI; // semicírculo superior
        const distance = Math.random() * mainRadius * 1.5;
        const radius = (3 + Math.random() * 6) * layerConfig.scaleMultiplier;
        const puff = {
          dx: Math.cos(angle) * distance * 1.2,
          dy: Math.sin(angle) * distance * 0.3,
          radius,
        };
        puffs.push(puff);

        minX = Math.min(minX, puff.dx - radius);
        maxX = Math.max(maxX, puff.dx + radius);
        minY = Math.min(minY, puff.dy - radius);
        maxY = Math.max(maxY, puff.dy + radius);
      }

      const cloudWidth = Math.ceil(maxX - minX);
      const cloudHeight = Math.ceil(maxY - minY);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.max(1, cloudWidth * PIXEL_SIZE);
      tempCanvas.height = Math.max(1, cloudHeight * PIXEL_SIZE);
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.imageSmoothingEnabled = false;
        const highlightColor = 'rgba(255, 255, 255, ' + layerConfig.alpha + ')';
        const midToneAlpha = Math.max(0, Math.min(1, layerConfig.alpha * 0.9));
        const shadowAlpha = Math.max(0, Math.min(1, layerConfig.alpha * 0.85));
        const midToneColor = 'rgba(215, 225, 235, ' + midToneAlpha + ')';
        const shadowColor = 'rgba(175, 185, 200, ' + shadowAlpha + ')';

        for (const puff of puffs) {
          const centerX = puff.dx - minX;
          const centerY = puff.dy - minY;
          drawPixelCircle(tempCtx, centerX, centerY, puff.radius, shadowColor);
          drawPixelCircle(tempCtx, centerX, centerY - 0.7, puff.radius * 0.85, midToneColor);
          drawPixelCircle(tempCtx, centerX - 0.2, centerY - 1.2, puff.radius * 0.65, highlightColor);
        }
      }

      return {
        x: Math.random() * gridWidth,
        y: Math.random() * (gridHeight * 0.55),
        speed: (0.015 + Math.random() * 0.05) * layerConfig.speedMultiplier,
        image: tempCanvas,
        widthInPixels: tempCanvas.width,
      };
    }

    const resize = () => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      c.width = Math.max(1, Math.floor(w * dpr));
      c.height = Math.max(1, Math.floor(h * dpr));
      g.imageSmoothingEnabled = false;
    };

    // Inicialización y observación de tamaño
    let ro: ResizeObserver | undefined;
    let winResizeHandler: (() => void) | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        resize();
        initLayers();
      });
      ro.observe(c);
    } else {
      winResizeHandler = () => { resize(); initLayers(); };
      window.addEventListener('resize', winResizeHandler);
    }

    // Capas en memoria
    let cloudLayers: Cloud[][] = [];

    function initLayers() {
      cloudLayers = [];
      for (const lc of LAYERS) {
        const clouds: Cloud[] = [];
        for (let i = 0; i < lc.count; i++) clouds.push(createCumulusCloud(lc));
        cloudLayers.push(clouds);
      }
    }

    resize();
    initLayers();

    const draw = () => {
      // Limpieza garantizada sin estelas
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'copy';
      g.fillStyle = 'rgba(0,0,0,0)';
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';

      for (let layerIndex = 0; layerIndex < cloudLayers.length; layerIndex++) {
        const clouds = cloudLayers[layerIndex];
        const layerConfig = LAYERS[layerIndex];
        g.globalAlpha = layerConfig.alpha; // alpha por capa
        for (let i = 0; i < clouds.length; i++) {
          const cloud = clouds[i];
          cloud.x += cloud.speed;
          const currentXInPixels = cloud.x * PIXEL_SIZE;

          if (currentXInPixels > c.width) {
            const newCloud = createCumulusCloud(layerConfig);
            const newCloudWidthInGrid = newCloud.widthInPixels / PIXEL_SIZE;
            newCloud.x = -newCloudWidthInGrid - (Math.random() * 30);
            clouds[i] = newCloud;
          }

          g.drawImage(
            cloud.image,
            Math.floor(currentXInPixels),
            Math.floor(cloud.y * PIXEL_SIZE)
          );
        }
        g.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (ro) ro.disconnect();
      if (winResizeHandler) window.removeEventListener('resize', winResizeHandler);
    };
  }, [enabled, dpr]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pixelated" aria-hidden />;
}
