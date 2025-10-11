import React from 'react';

// Whitelisted React demos per slug/componentKey
function QubitoDemo() {
  return (
    <div style={{ padding: 16, background: '#0b1220', color: '#e5e7eb', fontFamily: 'ui-sans-serif, system-ui, -apple-system' }}>
      <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Qubito POS (Demo)</h2>
      <p style={{ opacity: 0.8 }}>Aquí puedes montar un demo real en React para Qubito POS. Reemplaza este componente por tu contenido.</p>
      <div style={{ marginTop: 16, border: '1px solid #1f2937', borderRadius: 8, padding: 12 }}>
        <p style={{ marginBottom: 6 }}>• UI de ejemplo</p>
        <button style={{ padding: '8px 12px', background: '#facc15', color: '#111827', fontWeight: 600, borderRadius: 6 }}>Acción</button>
      </div>
    </div>
  );
}

const registry: Record<string, React.ReactNode> = {
  qubito: <QubitoDemo />,
};

export default async function FeaturedReactDemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const node = registry[slug.toLowerCase()] || (<div style={{ padding: 16 }}>No hay demo de React registrada para “{slug}”.</div>);
  return (
    <html>
      <body style={{ margin: 0 }}>{node}</body>
    </html>
  );
}
