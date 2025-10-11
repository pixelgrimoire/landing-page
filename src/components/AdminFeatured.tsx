"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FP = { id: string; slug: string; title: string; subtitle?: string | null; summary?: string | null; thumbnailUrl?: string | null; thumbnailHtml?: string | null; kind?: string | null; contentUrl?: string | null; componentKey?: string | null; html: string; active: boolean; sortOrder: number };

export default function AdminFeatured() {
  const [rows, setRows] = useState<FP[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<FP | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/featured', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo cargar');
      setRows((data.items || []) as FP[]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openCreate = () => {
    const nextOrder = (rows && rows.length) ? (Math.max(...rows.map(r => r.sortOrder || 0)) + 10) : 100;
    setEditing({ id: '', slug: '', title: '', subtitle: '', summary: '', thumbnailUrl: '', thumbnailHtml: '', kind: 'html', contentUrl: '', componentKey: '', html: '', active: true, sortOrder: nextOrder });
  };
  const cancel = () => { setEditing(null); refresh(); };
  const save = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/featured', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
      setEditing(null);
      refresh();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setBusy(false); }
  };

  const uploadThumb = async () => {
    if (!editing) return;
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Selecciona un archivo'); return; }
    if (!editing.slug) { setError('Define un slug antes de subir'); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('slug', editing.slug);
      const res = await fetch('/api/admin/featured/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo subir');
      setEditing({ ...(editing as FP), thumbnailUrl: data.url as string });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este destacado?')) return;
    setBusy(true);
    try { await fetch(`/api/admin/featured?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); refresh(); } finally { setBusy(false); }
  };

  if (editing) {
    return (
      <div className="space-y-3 text-white/90">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{editing.id ? 'Editar destacado' : 'Crear destacado'}</div>
          <button onClick={cancel} className="px-3 py-1.5 rounded-md border border-white/20 text-white/80 hover:bg-white/5">Cancelar</button>
        </div>
        {error && <div className="text-red-300">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">Slug
            <input value={editing.slug} onChange={e=>setEditing({ ...editing, slug: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs">Orden
            <input value={editing.sortOrder} onChange={e=>setEditing({ ...editing, sortOrder: Number(e.target.value)||0 })} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs col-span-2">Título
            <input value={editing.title} onChange={e=>{
              const t = e.target.value; const slugify = (s:string)=> s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
              setEditing({ ...(editing as FP), title: t, slug: (editing.slug ? editing.slug : slugify(t)) });
            }} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs col-span-2">Subtítulo
            <input value={editing.subtitle || ''} onChange={e=>setEditing({ ...editing, subtitle: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs col-span-2">Resumen
            <textarea value={editing.summary || ''} onChange={e=>setEditing({ ...editing, summary: e.target.value })} rows={2} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs col-span-2">Thumbnail URL (opcional)
            <input value={editing.thumbnailUrl || ''} onChange={e=>setEditing({ ...editing, thumbnailUrl: e.target.value })} placeholder="https://..." className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <div className="col-span-2 grid grid-cols-[1fr_auto] gap-2 items-center">
            <input ref={fileRef} type="file" accept="image/*" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
            <button type="button" disabled={busy || !editing.slug} onClick={uploadThumb} className="px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5 disabled:opacity-60">Subir</button>
          </div>
          <label className="text-xs col-span-2">Thumbnail HTML (opcional)
            <textarea value={editing.thumbnailHtml || ''} onChange={e=>setEditing({ ...(editing as FP), thumbnailHtml: e.target.value })} rows={4} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm font-mono" placeholder="&lt;div&gt;...&lt;/div&gt;" />
          </label>
          <label className="text-xs">Tipo
            <select value={editing.kind || 'html'} onChange={e=> setEditing({ ...(editing as FP), kind: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm">
              <option value="html">HTML (DB o Blob)</option>
              <option value="iframe">Iframe URL</option>
              <option value="image">Imagen</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="react">React (component)</option>
            </select>
          </label>
          <label className="text-xs">Content URL (opcional)
            <input value={editing.contentUrl || ''} onChange={e=>setEditing({ ...(editing as FP), contentUrl: e.target.value })} placeholder="https://... (iframe/image/video/pdf/html)" className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs">Component Key (react)
            <input value={editing.componentKey || ''} onChange={e=>setEditing({ ...(editing as FP), componentKey: e.target.value })} placeholder="qubito" className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-xs col-span-2">HTML (mockup / demo / sólo si Tipo = HTML inline)
            <textarea value={editing.html} onChange={e=>setEditing({ ...editing, html: e.target.value })} rows={12} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm font-mono" />
          </label>
          <label className="text-xs flex items-center gap-2">
            <input type="checkbox" checked={editing.active} onChange={e=>setEditing({ ...editing, active: e.target.checked })} /> Activo
          </label>
          <div />
          {/* Preview area */}
          <div className="col-span-2 mt-2">
            <div className="text-xs text-white/60 mb-2">Previsualización</div>
            <div className="grid md:grid-cols-2 gap-3">
              {/* Card preview */}
              <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                <div className="rounded-md mb-3 border border-white/10 overflow-hidden">
                  {editing.thumbnailHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: editing.thumbnailHtml || '' }} />
                  ) : editing.thumbnailUrl ? (
                    <img src={editing.thumbnailUrl} alt={editing.title} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="h-28 bg-gradient-to-br from-blue-500/15 via-violet-600/15 to-yellow-400/15" />
                  )}
                </div>
                <div className="text-white font-semibold mb-1 smooth-font">{editing.title || 'Título del proyecto'}</div>
                <div className="text-white/70 text-sm smooth-font">{editing.summary || editing.subtitle || 'Resumen o subtítulo'}</div>
              </div>
              {/* Mockup preview */}
              <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                <div className="text-xs text-white/60 mb-2">Mockup</div>
                <div style={{width:'100%', height:320}}>
                  {(() => {
                    const kind = (editing.kind || 'html').toLowerCase();
                    const url = editing.contentUrl || '';
                    if (kind === 'image' && url) return <img src={url} alt={editing.title} className="w-full h-full object-contain rounded-md"/>;
                    if (kind === 'video' && url) return <video src={url} controls className="w-full h-full rounded-md bg-black"/>;
                    if (kind === 'pdf' && url) return <iframe src={url} title={editing.title || 'pdf'} className="w-full h-full rounded-md"/>;
                    if (kind === 'iframe' && url) return <iframe src={url} title={editing.title || 'iframe'} className="w-full h-full rounded-md" sandbox="allow-scripts allow-popups"/>;
                    if (kind === 'react') return <iframe src={`/featured/app/${encodeURIComponent(editing.slug || 'demo')}`} title={editing.title || 'react'} className="w-full h-full rounded-md"/>;
                    // html inline or html via URL
                    if (url) return <iframe src={url} title={editing.title || 'html'} className="w-full h-full rounded-md"/>;
                    return <iframe srcDoc={editing.html || ''} title={editing.title || 'html-inline'} className="w-full h-full rounded-md"/>;
                  })()}
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <button disabled={busy || !editing.slug || !editing.title} onClick={save} className="px-3 py-2 rounded-md bg-yellow-400 text-black text-sm disabled:opacity-60">{busy ? 'Guardando…' : 'Guardar'}</button>
            {editing.slug && (
              <a className="ml-3 text-xs underline text-white/70" href={`/api/featured/view?slug=${encodeURIComponent(editing.slug)}&cb=${Date.now()}`} target="_blank" rel="noreferrer">Ver HTML</a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-white/90">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Proyectos Destacados</div>
        <button onClick={openCreate} className="px-3 py-2 rounded-md bg-yellow-400 text-black text-sm">Crear nuevo</button>
      </div>
      {loading && <div className="text-white/60">Cargando…</div>}
      {error && <div className="text-red-300">{error}</div>}
      {!loading && rows && (
        <div className="pixel-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/70">
              <tr>
                <th className="text-left p-2">Slug</th>
                <th className="text-left p-2">Título</th>
                <th className="text-left p-2">Activo</th>
                <th className="text-left p-2">Orden</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="p-2 font-mono text-xs">{r.slug}</td>
                  <td className="p-2">{r.title}</td>
                  <td className="p-2">{r.active ? 'Sí' : 'No'}</td>
                  <td className="p-2">{r.sortOrder}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/5" onClick={()=> setEditing(r)}>Editar</button>
                      <a className="px-2 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/5" href={`/api/featured/view?slug=${encodeURIComponent(r.slug)}&cb=${Date.now()}`} target="_blank" rel="noreferrer">Ver</a>
                      <button className="px-2 py-1 rounded-md border border-red-400/40 text-red-300 hover:bg-red-500/10" onClick={()=> remove(r.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
