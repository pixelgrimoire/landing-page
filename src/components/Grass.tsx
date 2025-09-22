// Componente placeholder para pasto/arbustos en el footer
'use client';

export default function Grass() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '12vh',
        zIndex: 3,
        pointerEvents: 'none',
        background: 'linear-gradient(to top, #4ade80 60%, transparent 100%)',
        opacity: 0.85,
      }}
    >
      {/* TODO: Reemplazar con SVG pixel-art de pasto/arbustos */}
    </div>
  );
}

