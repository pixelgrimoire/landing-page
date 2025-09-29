"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js';

type Props = {
  open: boolean;
  onClose: () => void;
  planId: string;
  cycle: 'monthly' | 'yearly';
  email?: string;
};

export default function CheckoutModal({ open, onClose, planId, cycle, email }: Props) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeP = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll when modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Initialize Embedded Checkout when open
  useEffect(() => {
    let active = true;
    (async () => {
      if (!open) return;
      if (!stripeP) { setError('Stripe publishable key missing'); return; }
      try {
        setLoading(true);
        setError(null);
        // Destroy previous instance if any
        if (checkoutRef.current) {
          try { checkoutRef.current.destroy?.(); } catch { /* ignore */ }
          checkoutRef.current = null;
        }
        const res = await fetch('/api/checkout/embedded', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, billingCycle: cycle, email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el checkout');
        const stripe = await stripeP;
        if (!stripe) throw new Error('Stripe no disponible');
        if (!containerRef.current) throw new Error('Contenedor no disponible');
        if (!active) return;
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: data.client_secret });
        checkoutRef.current = checkout;
        checkout.mount(containerRef.current);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error inesperado';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (checkoutRef.current) {
        try { checkoutRef.current.destroy?.(); } catch { /* ignore */ }
        checkoutRef.current = null;
      }
    };
  }, [open, stripeP, planId, cycle, email]);

  const startHostedFallback = async () => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle: cycle, email })
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'No se pudo iniciar el checkout');
      window.location.href = data.url as string;
    } catch (e) {
      // Surface the error
      setError(e instanceof Error ? e.message : 'Error inesperado');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl rounded-xl border border-white/10 bg-white/[.02] shadow-2xl backdrop-blur-md pixel-border">
          <button aria-label="Cerrar" onClick={onClose} className="absolute top-2 right-2 text-white/60 hover:text-white px-2 py-1">✕</button>
          <div className="relative p-4 sm:p-6 min-h-[560px] max-h-[85vh] overflow-auto magic-scroll">
            {error ? (
              <div className="text-red-300 space-y-3">
                <div>{error}</div>
                <div>
                  <button onClick={startHostedFallback} className="px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5">Continuar en Checkout alojado</button>
                </div>
              </div>
            ) : (
              <div className="min-h-[520px] relative" aria-busy={loading}>
                <div ref={containerRef} className="h-full" />
                {loading && (
                  <div className="absolute inset-0 grid place-items-center text-white/60">
                    <div className="animate-pulse">Cargando checkout…</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
