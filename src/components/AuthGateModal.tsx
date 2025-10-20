"use client";

import { useEffect, useState } from 'react';
import { SignIn, SignUp, useUser } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerkAppearance";
import PasswordHint from '@/components/PasswordHint';

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
};

export default function AuthGateModal({ open, onClose, onAuthed }: Props) {
  const { isSignedIn } = useUser();
  const [mode, setMode] = useState<"signup"|"signin">("signup");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // When user signs in (after verification if required), proceed
  useEffect(() => {
    if (!open) return;
    if (isSignedIn) {
      onAuthed();
      onClose();
    }
  }, [open, isSignedIn, onAuthed, onClose]);

  // Prevent background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-white/[.03] shadow-2xl backdrop-blur-md">
          <button aria-label="Cerrar" onClick={onClose} className="absolute top-2 right-2 text-white/60 hover:text-white px-2 py-1">✕</button>
          <div className="p-5">
            <h3 className="font-semibold mb-2">{mode === 'signup' ? 'Crea tu cuenta' : 'Inicia sesión'}</h3>
            {mounted && (
              mode === 'signup' ? (
                <div>
                  <SignUp routing="hash" appearance={clerkAppearance} />
                  <PasswordHint />
                </div>
              ) : (
                <SignIn routing="hash" appearance={clerkAppearance} />
              )
            )}
            <div className="text-xs text-white/60 mt-3 text-center">
              {mode === 'signup' ? (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button onClick={() => setMode('signin')} className="underline hover:text-white">Inicia sesión</button>
                </>
              ) : (
                <>
                  ¿Nuevo aquí?{' '}
                  <button onClick={() => setMode('signup')} className="underline hover:text-white">Crear cuenta</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
