'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

export default function SubscribePage({ searchParams }: { searchParams: { plan?: string; cycle?: 'monthly'|'yearly'; email?: string } }) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stripeP = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);

  useEffect(() => {
    (async () => {
      if (!stripeP) { setError('Stripe publishable key missing'); return; }
      const planId = (searchParams?.plan || 'apprentice').toString();
      const billingCycle = (searchParams?.cycle === 'monthly' ? 'monthly' : 'yearly') as 'monthly'|'yearly';
      setLoading(true);
      try {
        const res = await fetch('/api/checkout/embedded', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, billingCycle, email: searchParams?.email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el checkout');
        const stripe = await stripeP;
        if (!stripe) throw new Error('Stripe no disponible');
        if (!containerRef.current) throw new Error('Container no disponible');
        // Embedded Checkout
        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret: data.client_secret,
        });
        checkout.mount(containerRef.current);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error inesperado';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
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
    <div className="min-h-[70vh] flex items-center justify-center py-16">
      <div className="w-full max-w-xl min-h-[560px] pixel-border rounded bg-black/30 border border-white/10 p-4">
        {error ? (
          <div className="text-red-300">{error}</div>
        ) : (
          <div ref={containerRef} className="min-h-[520px]" aria-busy={loading}></div>
        )}
      </div>
    </div>
  );
}
