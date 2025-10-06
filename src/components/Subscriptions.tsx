"use client";

import { useCallback, useState } from 'react';
import MagicPlanCard from '@/components/MagicPlanCard';
import DockPlanCard from '@/components/DockPlanCard';
import ElementsCheckoutModal from '@/components/ElementsCheckoutModal';
import AuthGateModal from '@/components/AuthGateModal';
import { PLANS, type Plan } from '@/lib/constants';
import { useUser } from '@clerk/nextjs';

export default function Subscriptions({ magicEnabled = true }: { magicEnabled?: boolean }) {
  const { isSignedIn } = useUser();
  const [yearly, setYearly] = useState(false);
  const [loading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const subscribe = useCallback(async (plan: Plan) => {
    setSelectedPlan(plan);
    // If not signed in, show auth modal first; after auth, open checkout
    if (!isSignedIn) {
      setAuthOpen(true);
      return;
    }
    setCheckoutOpen(true);
  }, [isSignedIn]);

  const handleAuthed = useCallback(() => {
    // Open checkout once Clerk signals the session is active
    setCheckoutOpen(true);
  }, []);

  return (
    <section id="pricing" className="relative z-20 py-20" data-magic={magicEnabled ? 'on' : 'off'}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading + toggle */}
        <div className="text-center">
          <h2 className="text-white/80 smooth-font">Elige la opción que mejor se adapte a tu negocio. Cambia entre mensual y anual.</h2>
          <div className="mt-5 inline-flex items-center rounded-full bg-white/10 p-1 border border-white/15">
            <button
              className={`px-4 py-1.5 rounded-full text-sm smooth-font ${!yearly ? 'bg-rose-500 text-white shadow' : 'text-white/85 hover:bg-white/5'}`}
              onClick={() => setYearly(false)}
              disabled={loading}
            >
              Mensual
            </button>
            <button
              className={`ml-1 px-4 py-1.5 rounded-full text-sm smooth-font ${yearly ? 'bg-rose-500 text-white shadow' : 'text-white/85 hover:bg-white/5'}`}
              onClick={() => setYearly(true)}
              disabled={loading}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="relative grid md:grid-cols-3 gap-6 mt-10">
          {PLANS.map((p) => (
            magicEnabled ? (
              <MagicPlanCard key={p.id} plan={p} yearly={yearly} onSubscribeAction={subscribe} />
            ) : (
              <DockPlanCard key={p.id} plan={p} yearly={yearly} onSubscribeAction={subscribe} />
            )
          ))}
        </div>
        <div className="text-center text-white/60 text-sm mt-6 smooth-font">Sin contratos. Cancela en cualquier momento.</div>
        {/* Modal mount: custom Elements flow (preferred) */}
        <ElementsCheckoutModal
          open={checkoutOpen}
          onClose={()=> setCheckoutOpen(false)}
          planId={selectedPlan?.id || 'apprentice'}
          cycle={yearly ? 'yearly' : 'monthly'}
        />
        <AuthGateModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onAuthed={handleAuthed}
        />
      </div>
    </section>
  );
}
