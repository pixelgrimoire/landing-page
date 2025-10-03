'use client';

import { useCallback, useState } from 'react';
import MagicPlanCard from '@/components/MagicPlanCard';
import ElementsCheckoutModal from '@/components/ElementsCheckoutModal';
import AuthGateModal from '@/components/AuthGateModal';
import { PLANS, type Plan } from '@/lib/constants';
import { useUser } from '@clerk/nextjs';

export default function Subscriptions({ magicEnabled = true }: { magicEnabled?: boolean }) {
  const { isSignedIn } = useUser();
  const [yearly, setYearly] = useState(true);
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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-white text-2xl sm:text-3xl font-bold smooth-font">Subscripciones</h2>
          <div className="flex items-center gap-2 text-white/80 smooth-font">
            <span className={!yearly ? 'text-white' : 'text-white/60'}>Mensual</span>
            <button onClick={()=>setYearly(v=>!v)} className="px-2 py-1 rounded border border-white/20 hover:bg-white/5" disabled={loading}>{yearly? 'Anual ✓' : 'Anual'}</button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {PLANS.map(p=> (
            <MagicPlanCard key={p.id} plan={p} yearly={yearly} onSubscribeAction={subscribe} />
          ))}
        </div>
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
