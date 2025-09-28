"use client";

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SubscribeSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-white/80">Cargando…</div>}>
      <SubscribeSuccessInner />
    </Suspense>
  );
}

function SubscribeSuccessInner() {
  const sp = useSearchParams();
  const status = sp.get('checkout') || 'success';
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'No se pudo abrir el portal');
      window.location.href = data.url as string;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pg-bg min-h-screen text-white">
      <div className="max-w-2xl mx-auto px-4 py-24">
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-6 shadow-xl backdrop-blur-md">
          <h1 className="text-2xl font-bold mb-2 smooth-font">¡Gracias por suscribirte!</h1>
          <p className="text-white/70 mb-4">Tu estado: <span className="text-white">{status}</span></p>
          <div className="flex items-center gap-3">
            <Link href="/" className="px-4 py-2 rounded-md border border-white/20 hover:bg-white/5 pixel-font text-[11px] tracking-wider">Ir al inicio</Link>
            <button onClick={openPortal} disabled={loading} className="btn px-4 py-3 rounded-md bg-yellow-400 text-black pixel-font text-[11px] tracking-wider hover:bg-yellow-300 disabled:opacity-60">
              {loading ? 'Abriendo portal…' : 'Gestionar suscripción'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
