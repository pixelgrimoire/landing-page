'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, StripeElements, Stripe } from '@stripe/stripe-js';
import { paymentAppearance } from '@/lib/stripeAppearance';

export default function SubscribePixelPage({ searchParams }: { searchParams: { plan?: string; cycle?: 'monthly'|'yearly'; email?: string } }) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
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
        const res = await fetch('/api/subscribe/elements', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, billingCycle, email: searchParams?.email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el pago');
        const stripe = await stripeP;
        if (!stripe) throw new Error('Stripe no disponible');
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret: data.client_secret, appearance: paymentAppearance as unknown as import('@stripe/stripe-js').Appearance });
        elementsRef.current = elements;
        const paymentElement = elements.create('payment');
        if (!containerRef.current) throw new Error('Container no disponible');
        paymentElement.mount(containerRef.current);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error inesperado';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async () => {
    try {
      setLoading(true);
      const stripe = stripeRef.current; const elements = elementsRef.current;
      if (!stripe || !elements) throw new Error('Stripe/ELEMENTS no listos');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${origin}/?checkout=success` } });
      if (error) setError(error.message || 'No se pudo confirmar el pago');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!publishableKey) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/80">
        Falta configurar NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16">
      <div className="w-full max-w-xl min-h-[580px] pixel-border rounded bg-black/30 border border-white/10 p-5 space-y-4">
        <h1 className="text-yellow-200 font-bold pixel-font text-lg">Suscripción — Estilo Pixel</h1>
        {error && <div className="text-red-300 text-sm">{error}</div>}
        <div ref={containerRef} className="min-h-[520px]" aria-busy={loading}></div>
        <button onClick={confirm} disabled={loading} className="w-full px-4 py-2 rounded bg-yellow-400 text-black font-bold hover:bg-yellow-300 disabled:opacity-50 pixel-border">
          {loading ? 'Procesando…' : 'Confirmar pago'}
        </button>
      </div>
    </div>
  );
}
