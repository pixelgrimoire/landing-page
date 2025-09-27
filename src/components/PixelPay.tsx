'use client';

import { useEffect, useRef } from 'react';

export default function PixelPay({
  planName,
  unitPrice,
  currency = 'USD',
  paymentContainerRef,
  linkAuthContainerRef,
  onConfirm,
  loading,
  error,
}: {
  planName: string;
  unitPrice: number;
  currency?: string;
  paymentContainerRef: React.RefObject<HTMLDivElement | null>;
  linkAuthContainerRef?: React.RefObject<HTMLDivElement | null>;
  onConfirm: () => Promise<void> | void;
  loading: boolean;
  error?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // tiny intro pulse
    wrapRef.current?.animate(
      [
        { opacity: 0, transform: 'scale(.97)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 300, easing: 'ease-out' }
    );
  }, []);

  return (
    <div ref={wrapRef} className="min-h-[70vh] flex items-center justify-center py-12">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 md:gap-10 p-5 md:p-8 bg-[#0b0d12]/90 text-white pixel-border border border-white/10 shadow-[0_0_24px_rgba(255,174,0,.18)]">
        {/* Left: resumen */}
        <section className="space-y-4">
          <h2 className="text-yellow-200 pixel-font text-sm tracking-widest">RESUMEN</h2>
          <div className="bg-black/30 border-2 border-cyan-400/60 p-4">
            <div className="flex justify-between text-sm">
              <span className="opacity-80">Plan</span>
              <span className="font-semibold">{planName}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-cyan-400/30">
              <span className="opacity-80">Total</span>
              <span className="font-bold">{currency} {unitPrice.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-white/70">Pago seguro con Stripe. Tus datos están cifrados.</p>
        </section>

        {/* Right: Payment Element slot + confirm */}
        <section className="space-y-4">
          <h1 className="text-lg md:text-xl tracking-[0.25em] pixel-font text-yellow-200">P1XEL_PAY</h1>
          {error ? (
            <div className="text-red-300 bg-red-500/10 border border-red-500/30 p-3 rounded">{error}</div>
          ) : null}
          {linkAuthContainerRef && (
            <div className="mb-2 bg-black/20 border border-white/15 p-3" ref={linkAuthContainerRef} />
          )}
          <div ref={paymentContainerRef} className="min-h-[340px] bg-black/30 border border-white/15 p-3" />
          <button
            onClick={() => onConfirm()}
            disabled={loading}
            className="w-full px-4 py-3 bg-yellow-400 text-black font-bold pixel-border border-2 border-yellow-600 hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? 'Procesando…' : 'Confirmar pago'}
          </button>
        </section>
      </div>
    </div>
  );
}
