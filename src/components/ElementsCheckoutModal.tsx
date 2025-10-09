"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Elements, PaymentElement, useElements, useStripe, AddressElement } from '@stripe/react-stripe-js';
import type { StripeAddressElementChangeEvent } from '@stripe/stripe-js';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import { useUser } from '@clerk/nextjs';

type Props = {
  open: boolean;
  onClose: () => void;
  planId: string;
  cycle: 'monthly' | 'yearly';
};

function CheckoutForm({ intentType, customerId, subscriptionId, email, name, address }: { intentType: 'payment' | 'setup'; customerId?: string | null; subscriptionId?: string | null; email?: string; name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    let error;
    setErrMsg(null);
    const params = new URLSearchParams({ checkout: 'success' });
    if (customerId) params.set('customer_id', customerId);
    if (subscriptionId) params.set('subscription_id', subscriptionId);
    const returnUrl = `${window.location.origin}/subscribe/success?${params.toString()}`;
    const billing: Record<string, unknown> = {};
    if (email) billing.email = email;
    if (name) billing.name = name;
    if (address) billing.address = address;

    if (intentType === 'setup') {
      ({ error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: Object.keys(billing).length ? { billing_details: billing } : undefined,
        },
      }));
    } else {
      ({ error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: Object.keys(billing).length ? { billing_details: billing } : undefined,
        },
      }));
    }
    if (error) setErrMsg(error.message || 'No se pudo confirmar el pago');
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {errMsg && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded p-2">{errMsg}</div>
      )}
      <button type="submit" disabled={submitting || !stripe || !elements} className="btn w-full px-4 py-3 rounded-md bg-yellow-400 text-black pixel-font text-[12px] tracking-wider hover:bg-yellow-300 disabled:opacity-60">
        {submitting ? 'Procesando…' : 'Pagar y suscribirse'}
      </button>
    </form>
  );
}

function Inner({ planId, cycle, onClose }: { planId: string; cycle: 'monthly'|'yearly'; onClose: () => void }) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  const { user, isSignedIn } = useUser();
  const [seriousMode, setSeriousMode] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<'payment' | 'setup' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [layoutType, setLayoutType] = useState<'tabs' | 'accordion'>(
    () => (typeof window !== 'undefined' && window.innerWidth <= 640 ? 'accordion' : 'tabs')
  );
  const [promotionCode, setPromotionCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [lastInvalidPromo, setLastInvalidPromo] = useState<string | null>(null);
  const [price, setPrice] = useState<{ unit_amount: number | null; currency: string; interval: 'day'|'week'|'month'|'year' } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [totals, setTotals] = useState<{ subtotal?: number; tax?: number; total?: number; discount?: number; currency?: string; lineDescription?: string } | null>(null);
  const [planIdLabel, setPlanIdLabel] = useState('');
  const [billingCycleLabel, setBillingCycleLabel] = useState('');
  const [billingAddress, setBillingAddress] = useState<{ line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | undefined>(undefined);
  const [addrKey, setAddrKey] = useState(0);
  const [trialDays, setTrialDays] = useState<number | null>(null);
  

  // Detect global magic toggle to adapt Stripe appearance (serious mode)
  useEffect(() => {
    const el = document.querySelector('[data-magic]') as HTMLElement | null;
    const setFromAttr = () => setSeriousMode(el?.getAttribute('data-magic') === 'off');
    setFromAttr();
    if (!el) return;
    const mo = new MutationObserver(setFromAttr);
    mo.observe(el, { attributes: true, attributeFilter: ['data-magic'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => {
      const next = window.innerWidth <= 640 ? 'accordion' : 'tabs';
      setLayoutType(prev => (prev === next ? prev : next));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function formatMoney(amountMinor: number | null | undefined, currency: string) {
    if (amountMinor == null) return '—';
    try {
      const amt = amountMinor / 100;
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format(amt);
    } catch {
      return `${(amountMinor / 100).toFixed(2)} ${currency?.toUpperCase() || ''}`;
    }
  }

  const toTitle = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
  const normalizePromo = (s?: string | null) => (s ? s.trim().toUpperCase() : '');

  // Ensure line1 is populated. Some autocompletes may place the entire street into line2.
  const normalizeAddress = (a?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null) => {
    if (!a) return undefined;
    const line1 = (a.line1 || '').trim();
    const line2 = (a.line2 || '').trim();
    if (!line1 && line2) {
      return { ...a, line1: line2, line2: undefined };
    }
    return a;
  };

  const nameFromUser = useMemo(() => (user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined), [user?.fullName, user?.firstName, user?.lastName]);

  const createSession = useCallback(async (opts?: { promo?: string }) => {
    if (!stripePromise) { setError('Stripe publishable key missing'); return; }
    setPlanIdLabel(toTitle(planId));
    setBillingCycleLabel(cycle === 'yearly' ? 'Anual' : 'Mensual');
    if (!isSignedIn) {
      return;
    }
    try {
      const res = await fetch('/api/subscribe/elements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingCycle: cycle,
          email: !isSignedIn ? (email || undefined) : undefined,
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
      setSubscriptionId(data.subscription_id || null);
      setPriceId(data.price_id || null);
      setTrialDays(typeof data.trial_days === 'number' ? data.trial_days : null);
      if (typeof data.promotion_invalid !== 'undefined' && data.promotion_invalid) {
        setPromoError('Código de promoción no válido.');
        setLastInvalidPromo(normalizePromo(opts?.promo || promotionCode));
        try {
          if (customerId && priceId) {
            const res2 = await fetch('/api/subscribe/preview', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customerId, priceId, customerDetails: billingAddress ? { email, address: billingAddress } : (email ? { email } : undefined) })
            });
            const data2 = await res2.json();
            if (res2.ok) setTotals(data2);
          } else {
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
  }, [stripePromise, planId, cycle, isSignedIn, email, promotionCode, customerId, priceId, billingAddress, nameFromUser]);

  // Create a session once signed-in
  useEffect(() => {
    if (!stripePromise) return;
    if (clientSecret) return;
    if (!isSignedIn) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try { await createSession(); } finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [stripePromise, isSignedIn, clientSecret, createSession]);

  // Sync email from Clerk user
  useEffect(() => {
    const u = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (u && u !== email) setEmail(u);
  }, [user, email]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!customerId || !priceId) return;
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

  const appearance = useMemo<Appearance>(() => {
    if (seriousMode) {
      return {
        theme: 'night' as const,
        variables: {
          colorPrimary: '#e5e7eb',
          colorBackground: '#0b1220',
          colorText: '#e5e7eb',
          colorTextSecondary: '#9ca3af',
          colorIcon: '#9ca3af',
          colorDanger: '#ef4444',
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu',
          borderRadius: '8px',
          spacingUnit: '6px',
        },
        rules: {
          '.Label': { color: 'rgba(255,255,255,0.75)' },
          '.Error': { color: '#fca5a5' },
          '.Input': { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' },
          '.Input:focus': { outline: 'none', boxShadow: '0 0 0 2px rgba(255,255,255,0.35)' },
          '.Input--invalid': { borderColor: '#ef4444' },
          '.Tab, .Block': { backgroundColor: 'rgba(255,255,255,0.04)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.08)' },
          '.Tab:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
          '.Tab--selected': { borderColor: 'rgba(255,255,255,0.35)' },
        },
      } as Appearance;
    }
    return {
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
      },
    } as Appearance;
  }, [seriousMode]);

  return (
    <div className="relative w-full max-w-5xl rounded-xl border border-white/10 bg-white/[.02] shadow-2xl backdrop-blur-md pixel-border">
      {/* Pixel-art close button anchored to the card */}
      <button aria-label="Cerrar" onClick={onClose} className="pixel-close-btn -top-5 -right-5 z-20" title="Cerrar">
        <span className="btn-face" />
      </button>
      {(() => { const glowStyle = { ['--glow' as unknown as string]: '#FACC15' } as CSSProperties; return (<div className="edge-glow" style={glowStyle} />); })()}
      <div className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-white/5" />
      <div className="relative p-4 sm:p-6 max-h-[85vh] overflow-auto magic-scroll">
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
              <div className="absolute inset-0 grid place-items-center text-white/80 p-4">
                <div className="text-white/60 animate-pulse">Preparando…</div>
              </div>
            ) : (
              <Elements key={clientSecret || 'cs'} options={{ clientSecret, appearance, loader: 'always', locale: 'es' }} stripe={stripePromise}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left: Payment element + submit */}
                  <div className="md:col-span-6 space-y-4 min-w-0">
                    <div className="pixel-border rounded-lg p-3">
                      <PaymentElement
                        key={layoutType}
                        options={{
                          layout: { type: layoutType, defaultCollapsed: layoutType === 'accordion' },
                          // We collect address via AddressElement below; avoid duplication here
                          fields: { billingDetails: { name: 'auto', email: 'never', address: 'never' } },
                        }}
                      />
                    </div>
                    <CheckoutForm intentType={intentType} customerId={customerId} subscriptionId={subscriptionId} email={email} name={(user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined)}
                      // pass normalized address to billing_details at confirm
                      address={normalizeAddress(billingAddress)}
                    />
                  </div>
                  {/* Middle: Customer details (email + address) */}
                  <div className="md:col-span-3 space-y-4 min-w-0">
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
                          // AddressElement types require country when providing default address
                          defaultValues: { name: nameFromUser, address: (billingAddress ? { ...normalizeAddress(billingAddress), country: billingAddress.country || 'MX' } : undefined) as unknown as { country: string } },
                        }}
                        onChange={(e: StripeAddressElementChangeEvent)=> {
                          const a = e?.value?.address;
                          const raw = a ? { line1: a.line1, line2: a.line2 ?? undefined, city: a.city, state: a.state, postal_code: a.postal_code, country: a.country } : undefined;
                          const wasWeird = !!(raw && (!raw.line1 || raw.line1.trim() === '') && raw.line2);
                          const norm = normalizeAddress(raw);
                          setBillingAddress(norm);
                          if (wasWeird) setAddrKey(k => k + 1); // remount to apply normalized defaultValues
                        }}
                      />
                    </div>
                  </div>
                  {/* Right: Summary + promo */}
                  <div className="md:col-span-3 space-y-3 min-w-0 sm:sticky sm:top-0 md:sticky md:top-0">
                    <div className="pixel-border rounded-lg p-4">
                      <div className="text-sm font-semibold mb-1">Resumen</div>
                      <div className="text-xs text-white/70">Plan</div>
                      <div className="text-white mb-2">{planIdLabel} ({billingCycleLabel})</div>
                      <div className="text-xs text-white/70">Precio</div>
                      <div className="text-white mb-2">{price ? `${formatMoney(price.unit_amount, price.currency)} / ${price.interval === 'year' ? 'año' : price.interval === 'month' ? 'mes' : price.interval}` : '—'}</div>
                      {totals?.lineDescription && (
                        <div className="text-xs text-white/60 -mt-1 mb-2">{totals.lineDescription}</div>
                      )}
                      {trialDays && trialDays > 0 ? (
                        <div className="text-sm text-white/80 mt-3 space-y-1">
                          <div className="flex justify-between"><span className="text-white/70">Hoy</span><span>{formatMoney(0, price?.currency || 'USD')}</span></div>
                          <div className="text-emerald-400 text-[12px] mt-1">Prueba gratis de {trialDays} días</div>
                          {totals && (
                            <div className="flex justify-between mt-2"><span className="text-white/70">Luego</span><span>{formatMoney(totals.total ?? null, totals.currency || (price?.currency || 'USD'))}</span></div>
                          )}
                        </div>
                      ) : totals && (
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
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-stretch gap-2 min-w-0">
                        <input value={promotionCode} onChange={(e)=>{ const v = e.target.value; setPromotionCode(v); if (promoError) setPromoError(null); }} placeholder="PROMO" className="min-w-0 w-full bg-white/5 border border-white/10 rounded px-2 py-2 text-sm" />
                        <button
                          disabled={applying || !promotionCode || !!clientSecret || (!!promoError && normalizePromo(promotionCode) === normalizePromo(lastInvalidPromo))}
                          onClick={async()=>{
                            if (clientSecret) { setPromoError('Para cambiar el cupón cierra y vuelve a abrir el checkout.'); return; }
                            setApplying(true);
                            try { await createSession({ promo: promotionCode }); } finally { setApplying(false); }
                          }}
                          className="w-full sm:w-auto shrink-0 px-3 py-2 rounded bg-yellow-400 text-black text-sm disabled:opacity-60"
                        >{applying ? 'Aplicando…' : 'Aplicar'}</button>
                      </div>
                      {promoError && (<div className="text-[11px] text-red-300 mt-1">{promoError}</div>)}
                      <div className="text-[11px] text-white/50 mt-1">Cupón aplicable al crear la sesión. Para cambiarlo, reinicia este paso.</div>
                    </div>
                    <div className="text-[11px] text-white/50">
                      Al suscribirte autorizas cargos recurrentes según el plan seleccionado. Consulta nuestras <a className="underline hover:text-white" href="/terms" target="_blank" rel="noreferrer">Condiciones</a> y <a className="underline hover:text-white" href="/privacy" target="_blank" rel="noreferrer">Privacidad</a>.
                    </div>
                  </div>
                </div>
              </Elements>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ElementsCheckoutModal({ open, onClose, planId, cycle }: Props) {
  // ESC and overlay close behaviors
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Suspense fallback={<div className="text-white/80">Cargando…</div>}>
          <Inner planId={planId} cycle={cycle} onClose={onClose} />
        </Suspense>
      </div>
    </div>
  );
}
