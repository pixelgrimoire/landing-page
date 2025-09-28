"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Elements, PaymentElement, useElements, useStripe, LinkAuthenticationElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GlobalStyle from '@/components/GlobalStyle';
import { useUser } from '@clerk/nextjs';

function CheckoutForm({ intentType }: { intentType: 'payment' | 'setup' }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);  const [layoutType, setLayoutType] = useState<'tabs' | 'accordion'>(
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
        <PaymentElement
          key={layoutType}
          options={{
            layout: { type: layoutType, defaultCollapsed: layoutType === 'accordion' },
            fields: { billingDetails: { name: 'auto', email: 'never', address: 'auto' } },
          }}
        />
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
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-white/80">Cargandoâ€¦</div>}>
      <ElementsInner />
    </Suspense>
  );
}

function ElementsInner() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  const searchParams = useSearchParams();
  const { user, isSignedIn } = useUser();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<'payment' | 'setup' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [lastInvalidPromo, setLastInvalidPromo] = useState<string | null>(null);
  const [price, setPrice] = useState<{ unit_amount: number | null; currency: string; interval: 'day'|'week'|'month'|'year' } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | undefined>(searchParams.get('email') || undefined);
  const [totals, setTotals] = useState<{ subtotal?: number; tax?: number; total?: number; discount?: number; currency?: string; lineDescription?: string } | null>(null);
  const [planIdLabel, setPlanIdLabel] = useState('');
  const [billingCycleLabel, setBillingCycleLabel] = useState('');

  function formatMoney(amountMinor: number | null | undefined, currency: string) {
    if (amountMinor == null) return 'â€”';
    try {
      const amt = amountMinor / 100;
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format(amt);
    } catch {
      return `${(amountMinor / 100).toFixed(2)} ${currency?.toUpperCase() || ''}`;
    }
  }

  function toTitle(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
  }

  const normalizePromo = (s?: string | null) => (s ? s.trim().toUpperCase() : '');

  const createSession = useCallback(async (opts?: { promo?: string }) => {
    if (!stripePromise) { setError('Stripe publishable key missing'); return; }
    const planId = (searchParams.get('plan') || 'apprentice').toString();
    const billingCycle = (searchParams.get('cycle') === 'monthly' ? 'monthly' : 'yearly') as 'monthly'|'yearly';
    setPlanIdLabel(toTitle(planId));
    setBillingCycleLabel(billingCycle === 'yearly' ? 'Anual' : 'Mensual');
    try {
      const res = await fetch('/api/subscribe/elements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingCycle,
          // Si no estÃ¡ logueado, enviamos el email capturado; si estÃ¡ logueado, no es necesario
          email: !isSignedIn ? (email || searchParams.get('email') || undefined) : undefined,
          promotionCode: opts?.promo || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el pago');
      setClientSecret(data.client_secret as string);
      setIntentType(data.intent_type === 'setup' ? 'setup' : 'payment');
      setPrice(data.price || null);
      setCustomerId(data.customer_id || null);
      setPriceId(data.price_id || null);
      // Inline feedback if promo code was invalid
      if (typeof data.promotion_invalid !== 'undefined' && data.promotion_invalid) {
        setPromoError('CÃ³digo de promociÃ³n no vÃ¡lido.');
        setLastInvalidPromo(normalizePromo(opts?.promo || promotionCode));
        // Refresh preview WITHOUT promo to clear any lingering discount in the summary
        try {
          if (customerId && priceId) {
            const res2 = await fetch('/api/subscribe/preview', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customerId, priceId, customerDetails: email ? { email } : undefined })
            });
            const data2 = await res2.json();
            if (res2.ok) setTotals(data2);
          } else {
            // Fallback: at least clear discount locally if we can't refetch yet
            setTotals((prev) => prev ? { ...prev, discount: 0 } : prev);
          }
        } catch {}
      } else {
        setPromoError(null);
        setLastInvalidPromo(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    }
  }, [stripePromise, searchParams, isSignedIn, email, promotionCode, customerId, priceId]);

  useEffect(() => {
    (async () => {
      if (!stripePromise) { setError('Stripe publishable key missing'); return; }
      // Si estÃ¡ logueado o ya viene email en query, creamos la sesiÃ³n de inmediato
      const emailFromQuery = searchParams.get('email');
      if (isSignedIn || emailFromQuery) {
        setLoading(true);
        try { await createSession(); } finally { setLoading(false); }
      }
    })();
  }, [searchParams, stripePromise, isSignedIn, createSession]);

  // Si no estÃ¡ logueado y no se ha creado sesiÃ³n aÃºn, crÃ©ala cuando el usuario ingrese email
  useEffect(() => {
    if (!stripePromise) return;
    if (isSignedIn) return;
    if (clientSecret) return;
    if (!email) return;
    (async () => {
      setLoading(true);
      try { await createSession(); } finally { setLoading(false); }
    })();
  }, [email, isSignedIn, clientSecret, stripePromise, createSession]);

  // Debounced preview of totals
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!customerId || !priceId) return;
      // Avoid preview call if the promo is known invalid and hasn't changed
      if (promoError && normalizePromo(promotionCode) === normalizePromo(lastInvalidPromo)) return;
      try {
        const res = await fetch('/api/subscribe/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, priceId, promotionCode: promotionCode || undefined, customerDetails: email ? { email } : undefined })
        });
        const data = await res.json();
        if (res.ok) setTotals(data);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [customerId, priceId, promotionCode, email, promoError, lastInvalidPromo]);

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
            {loading && (<div className="absolute top-3 right-3 text-[11px] text-white/60">Preparando…</div>)}
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
                    <div className="animate-pulse">Cargandoâ€¦</div>
                  </div>
                ) : (
                  <Elements options={{ clientSecret, appearance, loader: 'always', locale: 'es' }} stripe={stripePromise}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="md:col-span-3 space-y-4">
                        <div className="pixel-border rounded-lg p-3">
                          <div className="mb-2 text-white/80 text-xs">Correo electrÃ³nico</div>
                          {isSignedIn ? (
                            <div className="px-3 py-2 rounded bg-white/5 border border-white/10 text-white/80 text-sm select-none cursor-not-allowed">
                              {user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || 'â€”'}
                            </div>
                          ) : (
                            <LinkAuthenticationElement
                              options={ email ? { defaultValues: { email } } : undefined }
                              onChange={(e)=> setEmail(e.value?.email || undefined) }
                            />
                          )}
                        </div>
                        <CheckoutForm intentType={intentType} />
                      </div>
                      <div className="md:col-span-2 space-y-3">
                        <div className="pixel-border rounded-lg p-4">
                          <div className="text-sm font-semibold mb-1">Resumen</div>
                          <div className="text-xs text-white/70">Plan</div>
                          <div className="text-white mb-2">{planIdLabel} ({billingCycleLabel})</div>
                          <div className="text-xs text-white/70">Precio</div>
                          <div className="text-white mb-2">{price ? `${formatMoney(price.unit_amount, price.currency)} / ${price.interval === 'year' ? 'aÃ±o' : price.interval === 'month' ? 'mes' : price.interval}` : 'â€”'}</div>
                          {totals?.lineDescription && (
                            <div className="text-xs text-white/60 -mt-1 mb-2">{totals.lineDescription}</div>
                          )}
                          {totals && (
                            <div className="text-sm text-white/80 mt-3 space-y-1">
                              <div className="flex justify-between"><span className="text-white/70">Subtotal</span><span>{formatMoney(totals.subtotal ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                              {!!(totals.discount && totals.discount > 0) && (
                                <div className="flex justify-between"><span className="text-white/70">Ahorro cupÃ³n</span><span>-{formatMoney(totals.discount ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-white/70">Impuestos</span><span>{formatMoney(totals.tax ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                              <div className="flex justify-between font-semibold"><span>Total hoy</span><span>{formatMoney(totals.total ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                            </div>
                          )}
                          {!totals && (<div className="mt-3 text-xs text-white/50">Impuestos calculados automÃ¡ticamente al confirmar.</div>)}
                        </div>
                        <div className="pixel-border rounded-lg p-3">
                          <div className="text-xs text-white/70 mb-1">CÃ³digo de promociÃ³n</div>
                          <div className="flex gap-2">
                            <input value={promotionCode} onChange={(e)=>{ const v = e.target.value; setPromotionCode(v); if (promoError) setPromoError(null); }} placeholder="PROMO" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-2 text-sm" />
                            <button disabled={applying || !promotionCode || (!!promoError && normalizePromo(promotionCode) === normalizePromo(lastInvalidPromo))} onClick={async()=>{ setApplying(true); try { await createSession({ promo: promotionCode }); } finally { setApplying(false); } }} className="px-3 py-2 rounded bg-yellow-400 text-black text-sm disabled:opacity-60">{applying ? 'Aplicandoâ€¦' : 'Aplicar'}</button>
                          </div>
                          {promoError && (<div className="text-[11px] text-red-300 mt-1">{promoError}</div>)}
                          <div className="text-[11px] text-white/50 mt-1">Si el cÃ³digo es vÃ¡lido, el total se actualizarÃ¡ al confirmar.</div>
                        </div>
                        <div className="text-[11px] text-white/50">
                          Al suscribirte autorizas cargos recurrentes segÃºn el plan seleccionado. Consulta nuestras <a className="underline hover:text-white" href="/terms" target="_blank">Condiciones</a> y <a className="underline hover:text-white" href="/privacy" target="_blank">Privacidad</a>.
                        </div>
                      </div>
                    </div>
                  </Elements>
                )}
              </div>
            )}
          </div>
          <div className="px-4 pb-4 text-[11px] text-white/40 smooth-font flex items-center justify-between">
            <Link href="/#pricing" className="text-white/60 hover:text-white">â† Volver a precios</Link>
            <span>Al continuar aceptas nuestras condiciones. Â¿Dudas? Soporte.</span>
          </div>
        </div>
      </div>
    </div>
  );
}


