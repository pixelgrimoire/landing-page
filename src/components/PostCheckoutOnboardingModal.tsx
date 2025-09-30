"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, SignUp, useUser } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';

type Props = {
  open: boolean;
  customerId?: string | null;
  onClose?: () => void;
};

const PROJECTS = [
  { slug: 'qubito', label: 'Qubito' },
  { slug: 'nexia', label: 'Nexia' },
  { slug: 'nexora', label: 'Nexora' },
  { slug: 'soja', label: 'Soja' },
];

export default function PostCheckoutOnboardingModal({ open, customerId, onClose }: Props) {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [step, setStep] = useState<'auth' | 'link' | 'projects' | 'done'>('auth');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cid, setCid] = useState<string | null>(customerId || null);
  const canProceed = useMemo(() => entitlements.length > 0 && entitlements.every(code => !!choices[code]), [entitlements, choices]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Avoid hydration mismatch with Clerk widgets
  useEffect(() => { setMounted(true); }, []);

  // Persist and recover customerId across auth redirects
  useEffect(() => {
    try {
      if (customerId) {
        setCid(customerId);
        localStorage.setItem('pg_checkout_cid', customerId);
      } else if (!cid) {
        const stored = localStorage.getItem('pg_checkout_cid');
        if (stored) setCid(stored);
      }
    } catch {}
  }, [customerId, cid]);

  useEffect(() => {
    if (!open) return;
    if (!isSignedIn) { setStep('auth'); return; }
    // When signed in, attempt to link customer
    if (step === 'auth') setStep('link');
  }, [open, isSignedIn, step]);

  useEffect(() => {
    (async () => {
      if (!open) return;
      if (step !== 'link') return;
      setError(null);
      let effectiveCid = cid;
      if (!effectiveCid) {
        try {
          const res = await fetch('/api/ensure-customer', { method: 'POST' });
          const data = await res.json();
          if (res.ok && data?.stripeCustomerId) {
            effectiveCid = String(data.stripeCustomerId);
            setCid(effectiveCid);
            try { localStorage.setItem('pg_checkout_cid', effectiveCid); } catch {}
          } else {
            setError(data?.error || 'Falta customerId para vincular');
            return;
          }
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Falta customerId para vincular');
          return;
        }
      }
      setLinking(true); setError(null);
      try {
        const res = await fetch('/api/link-customer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: effectiveCid }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo vincular la suscripción');
        // Load entitlements to ask for project selection
        const r2 = await fetch(`/api/entitlements?customerId=${encodeURIComponent(effectiveCid)}`);
        const d2 = await r2.json();
        if (r2.ok && Array.isArray(d2?.entitlements)) {
          setEntitlements(d2.entitlements as string[]);
        } else {
          setEntitlements([]);
        }
        setStep('projects');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error inesperado');
      } finally {
        setLinking(false);
      }
    })();
  }, [open, step, cid]);

  const saveProjects = async () => {
    setSaving(true); setError(null);
    try {
      for (const code of entitlements) {
        const proj = choices[code];
        if (!proj) continue;
        const res = await fetch('/api/projects/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entitlementCode: code, project: proj }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `No se pudo guardar selección para ${code}`);
      }
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally { setSaving(false); }
  };

  // Redirect to home once finished
  useEffect(() => {
    if (step === 'done') {
      const t = setTimeout(() => { router.push('/'); }, 800);
      return () => clearTimeout(t);
    }
  }, [step, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-xl border border-white/10 bg-white/[.03] shadow-2xl backdrop-blur-md">
          <button aria-label="Cerrar" onClick={onClose} className="absolute top-2 right-2 text-white/60 hover:text-white px-2 py-1">✕</button>
          <div className="p-5">
            {step === 'auth' && mounted && (
              <div className="grid place-items-center">
                <div className="w-full max-w-md">
                  {authMode === 'signup' ? (
                    <>
                      <h3 className="font-semibold mb-2">Crear cuenta</h3>
                      <SignUp routing="hash" signInUrl="#/sign-in" appearance={clerkAppearance} afterSignUpUrl="/subscribe/success" />
                      <div className="text-xs text-white/60 mt-2 text-center">
                        ¿Ya tienes cuenta? <button onClick={()=>setAuthMode('signin')} className="underline hover:text-white">Inicia sesión</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold mb-2">Iniciar sesión</h3>
                      <SignIn routing="hash" signUpUrl="#/sign-up" appearance={clerkAppearance} afterSignInUrl="/subscribe/success" />
                      <div className="text-xs text-white/60 mt-2 text-center">
                        ¿Nuevo aquí? <button onClick={()=>setAuthMode('signup')} className="underline hover:text-white">Crear cuenta</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {step === 'link' && (
              <div className="text-white/80">
                <div className="mb-2 font-semibold">Vinculando tu suscripción…</div>
                {error && <div className="text-red-300">{error}</div>}
                {linking && <div className="text-white/60">Procesando…</div>}
              </div>
            )}

            {step === 'projects' && (
              <div>
                <h3 className="font-semibold mb-2">Elige tus proyectos</h3>
                <p className="text-white/70 text-sm mb-4">Según tu suscripción, selecciona el proyecto activo para cada entitlement.</p>
                {error && <div className="text-red-300 mb-2">{error}</div>}
                {entitlements.length === 0 ? (
                  <div className="text-white/70">No encontramos entitlements activos. Puedes saltar este paso.</div>
                ) : (
                  <div className="space-y-4">
                    {entitlements.map(code => (
                      <div key={code} className="bg-white/5 border border-white/10 rounded p-3">
                        <div className="text-sm text-white/70 mb-2">Entitlement: <span className="text-white">{code}</span></div>
                        <div className="grid grid-cols-2 gap-2">
                          {PROJECTS.map(p => (
                            <button key={p.slug} onClick={() => setChoices(prev => ({ ...prev, [code]: p.slug }))} className={`px-3 py-2 rounded border ${choices[code]===p.slug ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}`}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={saveProjects} disabled={saving || (entitlements.length>0 && !canProceed)} className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar y continuar'}</button>
                  <button onClick={() => router.push('/')} className="px-4 py-2 rounded border border-white/10 bg-white/5 text-white/80">Hacerlo después</button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="text-white/80">
                <div className="font-semibold mb-2">¡Todo listo!</div>
                <p className="text-white/70 mb-4">Tu suscripción quedó vinculada y los proyectos seleccionados. Puedes cerrar este diálogo.</p>
                <button onClick={() => router.push('/')} className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold">Cerrar</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
