// Componente placeholder para colinas/montañas
'use client';

export default function Hills() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '15vh',
        height: '25vh',
        zIndex: 2,
        pointerEvents: 'none',
        background: 'linear-gradient(to top, #334155 60%, transparent 100%)',
        opacity: 0.8,
      }}
    >
      {/* TODO: Reemplazar con SVG pixel-art de colinas/montañas */}
    </div>
  );
}

