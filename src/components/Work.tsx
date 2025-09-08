"use client";

import React, { useState } from "react";
import { useRitualSummon } from "@/components/useRitualSummon";

export default function Work() {
  const items = [
    { title: 'Nexora POS', desc: 'Punto de venta local‑first con licencia offline y UI pixel.' },
    { title: 'CoreFoundry', desc: 'Plataforma modular estilo ‘factory sim’ para negocios.' },
    { title: 'Roblox Worlds', desc: 'Generadores procedurales y UIs retro para experiencias.' },
    { title: 'Open Source', desc: 'Pequeños hechizos de utilidades para la comunidad.' },
  ];

  const ritual = useRitualSummon({ color: "#818cf8", durationMs: 2200, intensity: 1 });
  const [selected, setSelected] = useState<{ title: string; desc: string } | null>(null);

  const onCardClick = (it: { title: string; desc: string }) => {
    setSelected(it);
    ritual.begin();
  };

  return (
    <section className="relative py-16" id="work">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-white text-2xl sm:text-3xl font-bold mb-6 smooth-font">Obras recientes</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => onCardClick(it)}
              className="text-left glass border border-white/10 rounded-2xl p-6 pixel-border fade-up cursor-pointer hover:border-white/20 transition-colors"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="h-28 rounded-md bg-gradient-to-br from-blue-500/15 via-violet-600/15 to-yellow-400/15 mb-4 border border-white/10" />
              <div className="text-white font-semibold mb-1 smooth-font">{it.title}</div>
              <div className="text-white/70 text-sm smooth-font">{it.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Ritual modal */}
      {ritual.open && (
        <ritual.RitualPortal title={selected?.title ?? "Proyecto"}>
          <p className="text-zinc-300">
            {selected?.desc ?? "Detalle del proyecto"}
          </p>
        </ritual.RitualPortal>
      )}
    </section>
  );
}
