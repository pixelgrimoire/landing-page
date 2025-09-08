"use client";

import React, { useState } from "react";
import { useRitualSummon } from "@/components/useRitualSummon";

export default function Work() {
  const items = [
    {
      title: 'Qubito POS',
      desc: 'Demo en desarrollo: Punto de venta local‑first con licencia offline, UI moderna y gestión integral para negocios. (Ver demo)',
      mockupUrl: '/POS-Qubito.html',
      thumbnail: <>
        <div className="h-16 flex items-center justify-center border-b border-slate-700">
          <svg className="h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
          </svg>
          <span className="ml-3 text-2xl font-bold">Qubito POS</span>
        </div>
      </>
    },
  ];

  const ritual = useRitualSummon({color: "#818cf8", durationMs: 2200, intensity: 1});
  const [selected, setSelected] = useState<{ title: string; desc: string; mockupUrl?: string } | null>(null);

  const onCardClick = (it: { title: string; desc: string; mockupUrl?: string }) => {
    setSelected(it);
    ritual.begin();
  };

  return (
      <section className="relative py-16" id="work">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-white text-2xl sm:text-3xl font-bold mb-6 smooth-font">Proyectos Destacados</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => onCardClick(it)}
              className="text-left glass border border-white/10 rounded-2xl p-6 pixel-border fade-up cursor-pointer hover:border-white/20 transition-colors"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="rounded-md mb-4 border border-white/10 overflow-hidden">
                {it.thumbnail ? (
                  it.thumbnail
                ) : (
                  <div className="h-28 bg-gradient-to-br from-blue-500/15 via-violet-600/15 to-yellow-400/15" />
                )}
              </div>
              <div className="text-white font-semibold mb-1 smooth-font">{it.title}</div>
              <div className="text-white/70 text-sm smooth-font">{it.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Ritual modal */}
      {ritual.open && (
        <ritual.RitualPortal title={selected?.title ?? "Proyecto"}>
          {selected?.mockupUrl ? (
            <div style={{width: '100%', maxWidth: 1200, height: '70vh', margin: '0 auto'}}>
              <iframe
                src={selected.mockupUrl}
                title="Demo Qubito POS"
                style={{width: '100%', height: '100%', border: 'none', borderRadius: 12, background: '#f1f5f9'}}
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-zinc-300">{selected?.desc ?? "Detalle del proyecto"}</p>
          )}
        </ritual.RitualPortal>
      )}
    </section>
  );
}
