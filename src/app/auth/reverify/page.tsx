'use client';

import { Suspense, useEffect } from 'react';

import { useClerk } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

function ReverifyContent() {
  const { signOut } = useClerk();
  const search = useSearchParams();

  useEffect(() => {
    const redirect = search?.get('redirect') || '/';
    const signInUrl = `/sign-in?redirect=${encodeURIComponent(redirect)}`;

    void signOut({
      redirectUrl: signInUrl,
    });
  }, [search, signOut]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16 text-center text-white/80">
      <div>
        <p className="mb-2">Verificando tu identidad…</p>
        <p className="text-sm">Te pediremos iniciar sesión nuevamente en Pixel Grimoire.</p>
      </div>
    </div>
  );
}

export default function ReverifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center py-16 text-center text-white/80">
          <div>
            <p className="mb-2">Preparando verificación…</p>
          </div>
        </div>
      }
    >
      <ReverifyContent />
    </Suspense>
  );
}
