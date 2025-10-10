"use client";

import type { Plan } from "@/lib/types";

export default function DockPlanCard({ plan, yearly, onSubscribeAction }: { plan: Plan; yearly: boolean; onSubscribeAction: (p: Plan) => void }) {
  const price = yearly ? plan.priceY : plan.priceM;
  const suffix = yearly ? "/año" : "/mes";
  const saving = yearly ? "Ahorra 20% pagando anual" : undefined;
  const comingSoon = !!plan.comingSoon;

  const primaryCta = `Conjurar nivel ${plan.name}`;
  const secondaryCta = comingSoon ? "Próximamente" : "Conocer más";
  const secondaryDisabled = comingSoon;

  return (
    <div className={`relative h-full rounded-2xl border bg-white/[.03] shadow-xl p-6 flex flex-col justify-between ${plan.popular ? 'border-emerald-500/70 ring-1 ring-emerald-500/40' : 'border-white/10'}`}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow">
            Más popular
          </span>
        </div>
      )}

      <div>
        <div className="text-white text-xl font-semibold smooth-font">{plan.name}</div>
        <div className="text-white/70 text-sm smooth-font mt-1">{plan.subtitle || ''}</div>
        <div className="mt-5">
          <div className="text-4xl font-extrabold text-white smooth-font">
            ${price}
            <span className="text-base text-white/60"> USD{suffix}</span>
          </div>
          {yearly && (
            <div className="text-emerald-400 text-sm mt-1 smooth-font">{saving}</div>
          )}
        </div>
        <ul className="mt-6 space-y-2 text-white/85 text-sm smooth-font">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[2px] shrink-0">
                <path d="M20 7L9 18l-5-5" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <button
          className={`w-full px-4 py-2 rounded-md bg-rose-500 hover:bg-rose-400 text-white font-semibold text-sm smooth-font ${comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
          disabled={comingSoon}
          onClick={() => { if (!comingSoon) onSubscribeAction(plan); }}
        >
          {comingSoon ? 'Próximamente' : primaryCta}
        </button>
        {!comingSoon && (
          <button
            className={`mt-3 w-full px-4 py-2 rounded-md text-white/90 text-sm border border-white/15 ${secondaryDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/5'}`}
            disabled={secondaryDisabled}
          >
            {secondaryCta}
          </button>
        )}
      </div>
    </div>
  );
}
