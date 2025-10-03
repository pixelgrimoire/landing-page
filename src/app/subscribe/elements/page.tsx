"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Elements, PaymentElement, useElements, useStripe, AddressElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GlobalStyle from '@/components/GlobalStyle';
import { useUser } from '@clerk/nextjs';
import AuthGateModal from '@/components/AuthGateModal';

function CheckoutForm({ intentType, email, name, address }: { intentType: 'payment' | 'setup'; email?: string; name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } }) {
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
    const billing: Record<string, unknown> = {};
    if (email) billing.email = email;
    if (name) billing.name = name;
    if (address) billing.address = address;

    if (intentType === 'setup') {
      ({ error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscribe/success?checkout=success`,
          payment_method_data: Object.keys(billing).length ? { billing_details: billing } : undefined,
        },
      }));
    } else {
      ({ error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscribe/success?checkout=success`,
          payment_method_data: Object.keys(billing).length ? { billing_details: billing } : undefined,
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
            // Avoid duplication; we collect address via AddressElement
            fields: { billingDetails: { name: 'auto', email: 'never', address: 'never' } },
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
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-white/80">Cargando…</div>}>
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
  const [authOpen, setAuthOpen] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [lastInvalidPromo, setLastInvalidPromo] = useState<string | null>(null);
  const [price, setPrice] = useState<{ unit_amount: number | null; currency: string; interval: 'day'|'week'|'month'|'year' } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [totals, setTotals] = useState<{ subtotal?: number; tax?: number; total?: number; discount?: number; currency?: string; lineDescription?: string } | null>(null);
  const [planIdLabel, setPlanIdLabel] = useState('');
  const [billingCycleLabel, setBillingCycleLabel] = useState('');
  const [billingAddress, setBillingAddress] = useState<{ line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | undefined>(undefined);
  const [addrKey, setAddrKey] = useState(0);
  const nameFromUser = useMemo(() => (user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined), [user?.fullName, user?.firstName, user?.lastName]);

  // Normalize address so line1 is always present
  const normalizeAddress = (a?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null) => {
    if (!a) return undefined;
    const line1 = (a.line1 || '').trim();
    const line2 = (a.line2 || '').trim();
    if (!line1 && line2) {
      return { ...a, line1: line2, line2: undefined };
    }
    return a;
  };

  function formatMoney(amountMinor: number | null | undefined, currency: string) {
    if (amountMinor == null) return '—';
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
          // Ya exigimos sesión: no enviamos email suelto
          email: undefined,
          promotionCode: opts?.promo || undefined,
          customerDetails: billingAddress
            ? { address: billingAddress, email, name: nameFromUser }
            : ((email || nameFromUser) ? { email, name: nameFromUser } : undefined),
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
        setPromoError('Código de promoción no válido.');
        setLastInvalidPromo(normalizePromo(opts?.promo || promotionCode));
        // Refresh preview WITHOUT promo to clear any lingering discount in the summary
        try {
          if (customerId && priceId) {
            const res2 = await fetch('/api/subscribe/preview', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customerId, priceId, customerDetails: billingAddress ? { email, address: billingAddress } : (email ? { email } : undefined) })
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
  }, [stripePromise, searchParams, email, promotionCode, customerId, priceId, billingAddress, nameFromUser]);

  useEffect(() => {
    (async () => {
      if (!stripePromise) { setError('Stripe publishable key missing'); return; }
      // Solo creamos la sesión si ya está logueado
      if (isSignedIn) {
        setLoading(true);
        try { await createSession(); } finally { setLoading(false); }
      }
    })();
  }, [stripePromise, isSignedIn, createSession]);

  // Sincroniza el email desde Clerk para usarlo en detalles del cliente
  useEffect(() => {
    const u = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (u && u !== email) setEmail(u);
  }, [user, email]);

  // Abrir modal de autenticación si no hay sesión
  useEffect(() => {
    if (!isSignedIn && !clientSecret) setAuthOpen(true);
    else setAuthOpen(false);
  }, [isSignedIn, clientSecret]);

  const handleAuthed = useCallback(async () => {
    // Al autenticarse, creamos la sesión y cerramos el modal
    if (clientSecret) return;
    setLoading(true);
    try { await createSession(); } finally { setLoading(false); }
  }, [clientSecret, createSession]);

  // Debounced preview of totals
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!customerId || !priceId) return;
      // Avoid preview call if the promo is known invalid and hasn't changed
      if (promoError && normalizePromo(promotionCode) === normalizePromo(lastInvalidPromo)) return;
      try {
        const res = await fetch('/api/subscribe/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, priceId, promotionCode: promotionCode || undefined, customerDetails: billingAddress ? { email, address: billingAddress } : (email ? { email } : undefined) })
        });
        const data = await res.json();
        if (res.ok) setTotals(data);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [customerId, priceId, promotionCode, email, promoError, lastInvalidPromo, billingAddress]);

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
      <AuthGateModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
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
                      <div className="animate-pulse">Cargando…</div>
                  </div>
                ) : (
                  <Elements key={clientSecret || 'cs'} options={{ clientSecret, appearance, loader: 'always', locale: 'es' }} stripe={stripePromise}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="md:col-span-3 space-y-4">
                        <div className="pixel-border rounded-lg p-3">
                          <div className="mb-2 text-white/80 text-xs">Correo electrónico</div>
                          <div className="px-3 py-2 rounded bg-white/5 border border-white/10 text-white/80 text-sm select-none cursor-not-allowed">
                            {user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || email || '—'}
                          </div>
                        </div>
                        <div className="pixel-border rounded-lg p-3">
                          <div className="mb-2 text-white/80 text-xs">Dirección de facturación</div>
                          <AddressElement
                            key={addrKey}
                            options={{
                              mode: 'billing',
                              fields: { phone: 'never' },
                              defaultValues: { name: (user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined), address: (billingAddress ? { ...normalizeAddress(billingAddress), country: billingAddress.country || 'MX' } : undefined) as unknown as { country: string } },
                            }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onChange={(e: any)=> {
                              const a = e?.value?.address || undefined;
                              const wasWeird = !!(a && (!a.line1 || String(a.line1).trim() === '') && a.line2);
                              const norm = normalizeAddress(a);
                              setBillingAddress(norm);
                              if (wasWeird) setAddrKey(k => k + 1);
                            }}
                          />
                        </div>
                        <CheckoutForm intentType={intentType} email={email} name={nameFromUser} address={billingAddress} />
                      </div>
                      <div className="md:col-span-2 space-y-3">
                        <div className="pixel-border rounded-lg p-4">
                          <div className="text-sm font-semibold mb-1">Resumen</div>
                          <div className="text-xs text-white/70">Plan</div>
                          <div className="text-white mb-2">{planIdLabel} ({billingCycleLabel})</div>
                          <div className="text-xs text-white/70">Precio</div>
                          <div className="text-white mb-2">{price ? `${formatMoney(price.unit_amount, price.currency)} / ${price.interval === 'year' ? 'año' : price.interval === 'month' ? 'mes' : price.interval}` : '—'}</div>
                          {totals?.lineDescription && (
                            <div className="text-xs text-white/60 -mt-1 mb-2">{totals.lineDescription}</div>
                          )}
                          {totals && (
                            <div className="text-sm text-white/80 mt-3 space-y-1">
                              <div className="flex justify-between"><span className="text-white/70">Subtotal</span><span>{formatMoney(totals.subtotal ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                              {!!(totals.discount && totals.discount > 0) && (
                                <div className="flex justify-between"><span className="text-white/70">Ahorro cupón</span><span>-{formatMoney(totals.discount ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-white/70">Impuestos</span><span>{formatMoney(totals.tax ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                              <div className="flex justify-between font-semibold"><span>Total hoy</span><span>{formatMoney(totals.total ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                            </div>
                          )}
                          {!totals && (<div className="mt-3 text-xs text-white/50">Impuestos calculados automáticamente al confirmar.</div>)}
                        </div>
                        <div className="pixel-border rounded-lg p-3">
                          <div className="text-xs text-white/70 mb-1">Código de promoción</div>
                          <div className="flex gap-2">
                            <input value={promotionCode} onChange={(e)=>{ const v = e.target.value; setPromotionCode(v); if (promoError) setPromoError(null); }} placeholder="PROMO" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-2 text-sm" />
                            <button
                              disabled={applying || !promotionCode || !!clientSecret || (!!promoError && normalizePromo(promotionCode) === normalizePromo(lastInvalidPromo))}
                              onClick={async()=>{
                                if (clientSecret) { setPromoError('Para cambiar el cupón cierra y vuelve a abrir el checkout.'); return; }
                                setApplying(true);
                                try { await createSession({ promo: promotionCode }); } finally { setApplying(false); }
                              }}
                              className="px-3 py-2 rounded bg-yellow-400 text-black text-sm disabled:opacity-60"
                            >{applying ? 'Aplicando…' : 'Aplicar'}</button>
                          </div>
                          {promoError && (<div className="text-[11px] text-red-300 mt-1">{promoError}</div>)}
                          <div className="text-[11px] text-white/50 mt-1">Cupón aplicable al crear la sesión. Para cambiarlo, reinicia este paso.</div>
                        </div>
                        <div className="text-[11px] text-white/50">
                          Al suscribirte autorizas cargos recurrentes según el plan seleccionado. Consulta nuestras <a className="underline hover:text-white" href="/terms" target="_blank">Condiciones</a> y <a className="underline hover:text-white" href="/privacy" target="_blank">Privacidad</a>.
                        </div>
                      </div>
                    </div>
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









