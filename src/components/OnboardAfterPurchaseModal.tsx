"use client";

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useUser, SignUp } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';

type Props = { open: boolean; onClose: () => void };

const PROJECTS = [
  { slug: 'qubito', label: 'Qubito' },
  { slug: 'nexia', label: 'Nexia' },
  { slug: 'nexora', label: 'Nexora' },
  { slug: 'soja', label: 'Soja' },
];

const DEFAULT_ENTITLEMENT = 'pos.basic';

export default function OnboardAfterPurchaseModal({ open, onClose }: Props) {
  const { isSignedIn } = useUser();
  const [step, setStep] = useState<'signup'|'link'|'select'|'done'>(isSignedIn ? 'link' : 'signup');
  const [linking, setLinking] = useState(false);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isSignedIn) setStep((s)=> s==='signup' ? 'link' : s); }, [isSignedIn]);

  useEffect(() => {
    if (!open) return;
    if (!isSignedIn || step !== 'link') return;
    let cancelled = false;
    (async () => {
      setLinking(true); setError(null);
      try {
        // Link Clerk user -> Stripe customer (by email)
        const res = await fetch('/api/ensure-customer', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo vincular la suscripción');
        if (cancelled) return;
        const cid: string | null = data.stripeCustomerId || null;
        setStripeCustomerId(cid);
        // Intenta cargar entitlements (reintentos cortos por si el webhook se demora)
        if (cid) {
          let tries = 5; let got: string[] | null = null;
          while (tries-- > 0 && !got) {
            const r = await fetch(`/api/entitlements?customerId=${encodeURIComponent(cid)}`, { cache: 'no-store' });
            const j = await r.json();
            if (r.ok && Array.isArray(j.entitlements)) got = j.entitlements as string[];
            if (!got) await new Promise(res=>setTimeout(res, 800));
          }
          setEntitlements(got || []);
        } else {
          setEntitlements([]);
        }
        setStep('select');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error inesperado');
      } finally { setLinking(false); }
    })();
    return () => { cancelled = true; };
  }, [open, isSignedIn, step]);

  const needsProjectChoice = useMemo(() => {
    return (entitlements || []).includes(DEFAULT_ENTITLEMENT);
  }, [entitlements]);

  async function saveProject() {
    setSaving(true); setError(null);
    try {
      if (!chosen) throw new Error('Elige un proyecto');
      const res = await fetch('/api/projects/select', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entitlementCode: DEFAULT_ENTITLEMENT, project: chosen })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl md:max-w-3xl rounded-xl border border-white/10 bg-white/[.02] shadow-2xl backdrop-blur-md pixel-border max-h-[85vh] overflow-y-auto">
          {(() => { const glowStyle = { ['--glow' as unknown as string]: '#FACC15' } as CSSProperties; return (<div className="edge-glow" style={glowStyle} />); })()}
          <button aria-label="Cerrar" onClick={onClose} className="pixel-close-btn -top-5 -right-5 z-20" title="Cerrar"><span className="btn-face" /></button>
          <div className="relative p-4 sm:p-6 text-white">
            <div className="mb-3 flex items-center justify-between text-white/80">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M12 2 4 6v6c0 5 4 9 8 10 4-1 8-5 8-10V6l-8-4Z" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span className="pixel-font text-[10px] tracking-wider">Completa tu registro</span>
              </div>
              <span className="pixel-font text-[10px] text-white/50">PixelGrimoire</span>
            </div>

            {step === 'signup' && (
              <div className="grid place-items-center">
                <div className="w-full max-w-md">
                  <SignUp routing="hash" signInUrl="/sign-in" appearance={clerkAppearance} />
                </div>
                <div className="text-[11px] text-white/50 mt-2">Al terminar, continuaremos con la vinculación.</div>
              </div>
            )}

            {step === 'link' && (
              <div className="min-h-[200px] grid place-items-center text-white/80">
                {linking ? 'Vinculando tu suscripción…' : (error || 'Listo')}
              </div>
            )}

            {step === 'select' && (
              <div>
                {needsProjectChoice ? (
                  <div>
                    <div className="text-sm text-white/80 mb-2">Elige tu app para este período</div>
                    <div className="grid sm:grid-cols-2 gap-2 mb-3">
                      {PROJECTS.map(p => (
                        <button key={p.slug} onClick={()=>setChosen(p.slug)} className={`px-4 py-2 rounded border ${chosen===p.slug ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}`}>{p.label}</button>
                      ))}
                    </div>
                    {error && <div className="text-red-300 text-sm mb-2">{error}</div>}
                    <div className="flex gap-2">
                      <button onClick={saveProject} disabled={saving || !chosen} className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button>
                      <button onClick={()=>setStep('done')} className="px-4 py-2 rounded border border-white/10 bg-white/5 text-white/80">Omitir por ahora</button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[160px] grid place-items-center text-white/80">
                    {entitlements ? 'No hay selección requerida. ¡Todo listo!' : 'Verificando entitlements…'}
                  </div>
                )}
              </div>
            )}

            {step === 'done' && (
              <div className="min-h-[160px] grid place-items-center text-white/90">
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">¡Listo!</div>
                  <div className="text-white/70 mb-4">Tu cuenta está vinculada{stripeCustomerId ? ' y configurada' : ''}.</div>
                  <div className="flex justify-center">
                    <a href="/account/projects" className="px-4 py-2 rounded-md border border-white/20 hover:bg-white/5 pixel-font text-[11px] tracking-wider">Gestionar proyecto</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

