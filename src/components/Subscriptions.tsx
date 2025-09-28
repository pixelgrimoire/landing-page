'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MagicPlanCard from '@/components/MagicPlanCard';
import { PLANS, type Plan } from '@/lib/constants';

export default function Subscriptions({ magicEnabled = true }: { magicEnabled?: boolean }) {
  const [yearly, setYearly] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const subscribe = async (plan: Plan) => {
    // Route to embedded checkout page with parameters
    try {
      setLoading(true);
      const cycle = yearly ? 'yearly' : 'monthly';
      const storedEmail = typeof window !== 'undefined' ? (localStorage.getItem('pg_email') || '') : '';
      const params = new URLSearchParams({ plan: plan.id, cycle });
      if (storedEmail) params.set('email', storedEmail);
      router.push(`/subscribe/elements?${params.toString()}`);
    } finally {
      setLoading(false);
    }
  };

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
      </div>
    </section>
  );
}
