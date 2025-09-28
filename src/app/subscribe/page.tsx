"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import GlobalStyle from '@/components/GlobalStyle';

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-white/80">Cargando…</div>}>
      <SubscribeInner />
    </Suspense>
  );
}

function SubscribeInner() {
  const searchParams = useSearchParams();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const checkoutRef = useRef<{ destroy?: () => void } | null>(null); // Holds the single Embedded Checkout instance
  const initializingRef = useRef(false); // Prevents parallel initializations
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stripeP = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);

  async function startRedirectCheckout() {
    try {
      const planId = (searchParams.get('plan') || 'apprentice').toString();
      const billingCycle = (searchParams.get('cycle') === 'monthly' ? 'monthly' : 'yearly') as 'monthly'|'yearly';
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle, email: searchParams.get('email') || undefined })
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'No se pudo iniciar el checkout');
      window.location.href = data.url as string;
    } catch (e) {
      console.error('Fallback checkout error', e);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (initializingRef.current) return; // avoid parallel runs
      initializingRef.current = true;
      try {
        if (!stripeP) { setError('Stripe publishable key missing'); return; }
        const planId = (searchParams.get('plan') || 'apprentice').toString();
        const billingCycle = (searchParams.get('cycle') === 'monthly' ? 'monthly' : 'yearly') as 'monthly'|'yearly';
        setLoading(true);

        // If there's a previous instance, destroy before creating a new one
        if (checkoutRef.current) {
          try { checkoutRef.current.destroy?.(); } catch { /* ignore */ }
          checkoutRef.current = null;
        }

        const res = await fetch('/api/checkout/embedded', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, billingCycle, email: searchParams.get('email') || undefined })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el checkout');
        const stripe = await stripeP;
        if (!stripe) throw new Error('Stripe no disponible');
        if (!containerRef.current) throw new Error('Container no disponible');
        if (!active) return;
        // Embedded Checkout (single instance)
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: data.client_secret });
        checkoutRef.current = checkout;
        checkout.mount(containerRef.current);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error inesperado';
        setError(msg);
      } finally {
        setLoading(false);
        initializingRef.current = false;
      }
    })();

    return () => {
      active = false;
      // Clean up any existing checkout instance on unmount or hot-reload
      if (checkoutRef.current) {
        try { checkoutRef.current.destroy?.(); } catch { /* ignore */ }
        checkoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!publishableKey) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/80">
        Falta configurar NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      </div>
    );
  }

  return (
    <div className="pg-bg min-h-screen text-white relative overflow-x-clip">
      <div className="min-h-[80vh] flex items-center justify-center py-16 px-4">
        <GlobalStyle />
        <div className="relative w-full max-w-3xl min-h-[640px] rounded-xl border border-white/10 bg-white/[.02] shadow-2xl backdrop-blur-md pixel-border">
        <div className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-white/5" />
        <div className="relative p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between text-white/80">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M6 10V8a6 6 0 1 1 12 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="15" r="1.5" fill="currentColor" />
              </svg>
              <span className="smooth-font text-sm">Pago seguro con Stripe</span>
            </div>
            <span className="pixel-font text-[10px] text-white/50">PixelGrimoire</span>
          </div>
          {error ? (
            <div className="text-red-300 space-y-3">
              <div>{error}</div>
              <button onClick={startRedirectCheckout} className="px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5">
                Continuar en Checkout alojado
              </button>
            </div>
          ) : (
            <div className="min-h-[600px] relative" aria-busy={loading}>
              {/* Stripe mount target MUST be empty */}
              <div ref={containerRef} className="h-full" />
              {loading && (
                <div className="absolute inset-0 grid place-items-center text-white/60">
                  <div className="animate-pulse">Cargando checkout…</div>
                </div>
              )}
            </div>
          )}
        </div>
          <div className="px-4 pb-4 text-[11px] text-white/40 smooth-font flex items-center justify-between">
            <Link href="/#pricing" className="text-white/60 hover:text-white">← Volver a precios</Link>
            <span>Al continuar aceptas nuestras condiciones. ¿Dudas? Soporte.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
