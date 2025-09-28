"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import GlobalStyle from '@/components/GlobalStyle';

function CheckoutForm({ clientSecret, intentType }: { clientSecret: string; intentType: 'payment' | 'setup' }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const router = useRouter();
  const [layoutType, setLayoutType] = useState<'tabs' | 'accordion'>(
    () => (typeof window !== 'undefined' && window.innerWidth <= 640 ? 'accordion' : 'tabs')
  );

  useEffect(() => {
    const onResize = () => {
      const next = window.innerWidth <= 640 ? 'accordion' : 'tabs';
      setLayoutType(prev => (prev === next ? prev : next));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    let error;
    setErrMsg(null);
    if (intentType === 'setup') {
      ({ error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscribe/success?checkout=success`,
        },
      }));
    } else {
      ({ error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscribe/success?checkout=success`,
        },
      }));
    }
    if (error) {
      setErrMsg(error.message || 'No se pudo confirmar el pago');
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errMsg && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded p-2">{errMsg}</div>
      )}
      <div className="pixel-border rounded-lg p-3">
        <PaymentElement key={layoutType} options={{ layout: { type: layoutType, defaultCollapsed: layoutType === 'accordion' } }} />
      </div>
      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="btn w-full px-4 py-3 rounded-md bg-yellow-400 text-black pixel-font text-[12px] tracking-wider hover:bg-yellow-300 disabled:opacity-60"
      >
        {submitting ? 'Procesando…' : 'Pagar y suscribirse'}
      </button>
    </form>
  );
}

export default function ElementsSubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-white/80">Cargando…</div>}>
      <ElementsInner />
    </Suspense>
  );
}

function ElementsInner() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  const searchParams = useSearchParams();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<'payment' | 'setup' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!stripePromise) { setError('Stripe publishable key missing'); return; }
      const planId = (searchParams.get('plan') || 'apprentice').toString();
      const billingCycle = (searchParams.get('cycle') === 'monthly' ? 'monthly' : 'yearly') as 'monthly'|'yearly';
      setLoading(true);
      try {
        const res = await fetch('/api/subscribe/elements', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, billingCycle, email: searchParams.get('email') || undefined })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el pago');
        setClientSecret(data.client_secret as string);
        setIntentType(data.intent_type === 'setup' ? 'setup' : 'payment');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error inesperado');
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams, stripePromise]);

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#FACC15',
      colorBackground: '#0b1220',
      colorText: '#e5e7eb',
      colorTextSecondary: '#9ca3af',
      colorIcon: '#9ca3af',
      colorDanger: '#f87171',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu',
      borderRadius: '10px',
      spacingUnit: '6px',
    },
    rules: {
      '.Label': { color: 'rgba(255,255,255,0.7)' },
      '.Error': { color: '#fca5a5' },
      '.Input': { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' },
      '.Input:focus': { outline: 'none', boxShadow: '0 0 0 2px rgba(250,204,21,0.45)' },
      '.Input--invalid': { borderColor: '#f87171' },
      '.Tab, .Block': { backgroundColor: 'rgba(255,255,255,0.03)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.06)' },
      '.Tab:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
      '.Tab--selected': { borderColor: 'rgba(250,204,21,0.5)' },
    }
  } as const;

  return (
    <div className="pg-bg min-h-screen text-white relative overflow-x-clip">
      <div className="min-h-[80vh] flex items-center justify-center py-16 px-4">
        <GlobalStyle />
        <div className="relative w-full max-w-3xl min-h-[640px] rounded-xl border border-white/10 bg-white/[.02] shadow-2xl backdrop-blur-md pixel-border">
          {(() => { const glowStyle = { ['--glow' as unknown as string]: '#FACC15' } as CSSProperties; return (<div className="edge-glow" style={glowStyle} />); })()}
          <div className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-white/5" />
          <div className="relative p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between text-white/80">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M6 10V8a6 6 0 1 1 12 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="15" r="1.5" fill="currentColor" />
                </svg>
                <span className="pixel-font text-[10px] tracking-wider">Pago seguro con Stripe</span>
              </div>
              <span className="pixel-font text-[10px] text-white/50">PixelGrimoire</span>
            </div>

            {!publishableKey && (
              <div className="text-red-300">Falta configurar NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</div>
            )}

            {error && (
              <div className="text-red-300 space-y-3">
                <div>{error}</div>
              </div>
            )}

            {!error && (
              <div className="relative min-h-[560px]">
                {!clientSecret || !stripePromise || !intentType ? (
                  <div className="absolute inset-0 grid place-items-center text-white/60">
                    <div className="animate-pulse">Cargando…</div>
                  </div>
                ) : (
                  <Elements options={{ clientSecret, appearance, loader: 'always' }} stripe={stripePromise}>
                    <CheckoutForm clientSecret={clientSecret} intentType={intentType} />
                  </Elements>
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
