"use client";

import React, { useEffect, useState } from "react";
import { useRitualSummon } from "@/components/useRitualSummon";

export default function Work({ magicEnabled = true }: { magicEnabled?: boolean }) {
  const [items, setItems] = useState<Array<{ slug: string; title: string; subtitle?: string | null; summary?: string | null; thumbnailUrl?: string | null; thumbnailHtml?: string | null; kind?: string | null; contentUrl?: string | null }>>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/featured', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && Array.isArray(data?.items)) setItems(data.items);
        else setItems([]);
      } catch { setItems([]); }
    })();
  }, []);

  const ritual = useRitualSummon({color: "#818cf8", durationMs: magicEnabled ? 2200 : 1, intensity: magicEnabled ? 1 : 0.8});
  const [selected, setSelected] = useState<{ slug: string; title: string; desc?: string; kind?: string | null; contentUrl?: string | null } | null>(null);
  const [simpleOpen, setSimpleOpen] = useState(false);

  const onCardClick = (it: { slug: string; title: string; summary?: string | null; kind?: string | null; contentUrl?: string | null }) => {
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
              key={it.slug}
              onClick={() => onCardClick({ slug: it.slug, title: it.title, summary: it.summary || it.subtitle || '', kind: it.kind || 'html', contentUrl: it.contentUrl || null })}
              className="text-left glass border border-white/10 rounded-2xl p-6 pixel-border fade-up cursor-pointer hover:border-white/20 transition-colors"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {it.thumbnailHtml ? (
                <div className="rounded-md mb-4 border border-white/10 overflow-hidden" dangerouslySetInnerHTML={{ __html: it.thumbnailHtml || '' }} />
              ) : it.thumbnailUrl ? (
                <img src={it.thumbnailUrl} alt={it.title} className="rounded-md mb-4 border border-white/10 overflow-hidden h-28 w-full object-cover" />
              ) : (
                <div className="rounded-md mb-4 border border-white/10 overflow-hidden h-28 bg-gradient-to-br from-blue-500/15 via-violet-600/15 to-yellow-400/15" />
              )}
              <div className="text-white font-semibold mb-1 smooth-font">{it.title}</div>
              <div className="text-white/70 text-sm smooth-font">{it.summary || it.subtitle || ''}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Ritual modal */}
      {ritual.open && (
        <ritual.RitualPortal title={selected?.title ?? "Proyecto"}>
          {selected ? (
            <div style={{width: '100%', maxWidth: 1200, height: '70vh', margin: '0 auto'}}>
              {selected.kind === 'image' && selected.contentUrl ? (
                <img src={selected.contentUrl} alt={selected.title} style={{width:'100%', height:'100%', objectFit:'contain', background:'#111827', borderRadius: 12}} />
              ) : selected.kind === 'video' && selected.contentUrl ? (
                <video src={selected.contentUrl} controls style={{width:'100%', height:'100%', background:'#111827', borderRadius: 12}} />
              ) : selected.kind === 'pdf' && selected.contentUrl ? (
                <iframe src={selected.contentUrl} title={selected.title} style={{width:'100%', height:'100%', border:'none', borderRadius:12, background:'#f1f5f9'}} />
              ) : selected.kind === 'iframe' && selected.contentUrl ? (
                <iframe src={selected.contentUrl} title={selected.title} style={{width:'100%', height:'100%', border:'none', borderRadius:12, background:'#f1f5f9'}} sandbox="allow-scripts allow-popups" />
              ) : selected.kind === 'react' ? (
                <iframe src={`/featured/app/${encodeURIComponent(selected.slug)}?cb=${Date.now()}`} title={selected.title} style={{width:'100%', height:'100%', border:'none', borderRadius:12, background:'#0b1220'}} />
              ) : (
                <iframe src={selected.contentUrl ? selected.contentUrl : (`/api/featured/view?slug=${encodeURIComponent(selected.slug)}&cb=${Date.now()}`)} title={selected.title} style={{width:'100%', height:'100%', border:'none', borderRadius:12, background:'#f1f5f9'}} />
              )}
            </div>
          ) : (
            <p className="text-zinc-300">Detalle del proyecto</p>
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
                {selected ? (
                  <div style={{width: '100%', maxWidth: 1200, height: '70vh', margin: '0 auto'}}>
                    <iframe src={`/api/featured/view?slug=${encodeURIComponent(selected.slug)}&cb=${Date.now()}`} title={selected?.title || 'Demo'} style={{width: '100%', height: '100%', border: 'none', borderRadius: 12, background: '#f1f5f9'}} allowFullScreen />
                  </div>
                ) : (
                  <div className="p-4 text-zinc-300 smooth-font">Detalle del proyecto</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
