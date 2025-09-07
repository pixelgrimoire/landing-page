'use client';

import { useState } from 'react';
import MagicPlanCard from '@/components/MagicPlanCard';
import { MAIL_TO, PLANS, type Plan } from '@/lib/constants';

export default function Subscriptions() {
  const [yearly, setYearly] = useState(true);
  const [email, setEmail] = useState('');
  const subscribe = (plan: Plan) => {
    const subject = encodeURIComponent(`PixelGrimoire subscription — ${plan.name}`);
    const body = encodeURIComponent(`Plan: ${plan.name}
Billing: ${yearly ? 'Yearly' : 'Monthly'}
Email: ${email || '(write here)'}
Message: `);
    window.location.href = `${MAIL_TO}?subject=${subject}&body=${body}`;
  };
  return (
    <section id="pricing" className="relative z-20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-white text-2xl sm:text-3xl font-bold smooth-font">Subscripciones</h2>
          <div className="flex items-center gap-2 text-white/80 smooth-font">
            <span className={!yearly ? 'text-white' : 'text-white/60'}>Mensual</span>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email" className="w-full sm:w-80 px-3 py-2 rounded-md border border-white/20 bg-transparent text-white placeholder-white/40 outline-none"/>
            <button onClick={()=>setYearly(v=>!v)} className="px-2 py-1 rounded border border-white/20 hover:bg-white/5">{yearly? 'Anual ✓' : 'Anual'}</button>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email" className="w-full sm:w-80 px-3 py-2 rounded-md border border-white/20 bg-transparent text-white placeholder-white/40 outline-none"/>
          <a href={MAIL_TO} className="px-4 py-2 rounded-md bg-yellow-400 text-black font-semibold pixel-font">Soporte</a>
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
