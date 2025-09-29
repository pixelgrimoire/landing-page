"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import GlobalStyle from '@/components/GlobalStyle';
import PostCheckoutOnboardingModal from '@/components/PostCheckoutOnboardingModal';

export default function SubscribeSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-white/80">Cargando…</div>}>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(true);
  const customerId = sp.get('customer_id');

  useEffect(() => { setOpen(true); }, []);

  return (
    <div className="pg-bg min-h-screen text-white">
      <GlobalStyle />
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold pixel-font mb-2">¡Gracias por tu compra!</h1>
        <p className="text-white/70">Tu pago fue exitoso. Ahora terminemos tu registro para vincular tu suscripción a tu cuenta.</p>
      </div>
      <PostCheckoutOnboardingModal open={open} customerId={customerId} onClose={() => setOpen(false)} />
    </div>
  );
}
