'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, type StripeElements, type Stripe } from '@stripe/stripe-js';
import { paymentAppearance } from '@/lib/stripeAppearance';
import PixelPay from '@/components/PixelPay';

export default function SubscribePixelPage({ searchParams }: { searchParams: { plan?: string; cycle?: 'monthly'|'yearly'; email?: string } }) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const paymentRef = useRef<HTMLDivElement | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stripeP = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);
  const linkRef = useRef<HTMLDivElement | null>(null);

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
        // Link Authentication (email)
        try {
          if (linkRef.current) {
            const opts: Record<string, unknown> = { defaultValues: { email: (searchParams?.email || '') as string } };
            const linkEl = elements.create('linkAuthentication', opts as never);
            linkEl.mount(linkRef.current);
          }
        } catch {}
        const paymentElement = elements.create('payment');
        if (!paymentRef.current) throw new Error('Container no disponible');
        paymentElement.mount(paymentRef.current);
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

  const planName = (searchParams?.plan || 'Apprentice') + (searchParams?.cycle === 'yearly' ? ' (Anual)' : ' (Mensual)');
  return (
    <PixelPay
      planName={planName}
      unitPrice={0}
      currency="USD"
      paymentContainerRef={paymentRef}
      linkAuthContainerRef={linkRef}
      onConfirm={confirm}
      loading={loading}
      error={error}
    />
  );
}
