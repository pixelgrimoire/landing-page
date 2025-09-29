"use client";

import React, { useState } from "react";
import { useRitualSummon } from "@/components/useRitualSummon";

export default function Work({ magicEnabled = true }: { magicEnabled?: boolean }) {
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

  const ritual = useRitualSummon({color: "#818cf8", durationMs: magicEnabled ? 2200 : 1, intensity: magicEnabled ? 1 : 0.8});
  const [selected, setSelected] = useState<{ title: string; desc: string; mockupUrl?: string } | null>(null);
  const [simpleOpen, setSimpleOpen] = useState(false);

  const onCardClick = (it: { title: string; desc: string; mockupUrl?: string }) => {
    setSelected(it);
    if (magicEnabled) {
      ritual.begin();
    } else {
      setSimpleOpen(true);
    }
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

      {/* Simple modal (no magic) */}
      {!magicEnabled && simpleOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80" onClick={() => setSimpleOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-[1200px] bg-zinc-900/95 border border-white/10 rounded-xl shadow-xl">
              <div className="p-3 flex items-center justify-between border-b border-white/10">
                <div className="text-white/90 font-semibold smooth-font">{selected?.title ?? 'Proyecto'}</div>
                <button onClick={() => setSimpleOpen(false)} className="px-3 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/5">Cerrar</button>
              </div>
              <div className="p-0">
                {selected?.mockupUrl ? (
                  <div style={{width: '100%', maxWidth: 1200, height: '70vh', margin: '0 auto'}}>
                    <iframe src={selected.mockupUrl} title={selected?.title || 'Demo'} style={{width: '100%', height: '100%', border: 'none', borderRadius: 12, background: '#f1f5f9'}} allowFullScreen />
                  </div>
                ) : (
                  <div className="p-4 text-zinc-300 smooth-font">{selected?.desc ?? 'Detalle del proyecto'}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
