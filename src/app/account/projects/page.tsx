'use client';

import { useEffect, useMemo, useState } from 'react';

type Selection = {
  id: string;
  customerId: string;
  entitlementCode: string;
  currentProject: string | null;
  pendingProject: string | null;
  pendingEffectiveAt: string | null;
};

const PROJECTS = [
  { slug: 'qubito', label: 'Qubito' },
  { slug: 'nexia', label: 'Nexia' },
  { slug: 'nexora', label: 'Nexora' },
  { slug: 'soja', label: 'Soja' },
];

// Assumption: Apprentice => entitlementCode 'pos.basic'. Adjust if different in your env vars.
const DEFAULT_ENTITLEMENT = 'pos.basic';

export default function ProjectSelectionPage() {
  const [entitlementCode, setEntitlementCode] = useState(DEFAULT_ENTITLEMENT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [chosen, setChosen] = useState('');

  const pendingDate = useMemo(() => {
    const iso = selection?.pendingEffectiveAt;
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }, [selection?.pendingEffectiveAt]);

  async function load() {
    setError(null); setMessage(null);
    try {
      const res = await fetch(`/api/projects/current?entitlementCode=${encodeURIComponent(entitlementCode)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo cargar la selección');
      setSelection(data.selection ?? null);
      setChosen(data.selection?.currentProject || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [entitlementCode]);

  async function submit() {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (!chosen) throw new Error('Elige un proyecto');
      const res = await fetch('/api/projects/select', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entitlementCode, project: chosen })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
      setMessage(data.message || 'Guardado');
      setSelection(data.selection);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally { setLoading(false); }
  }

  return (
    <div className="pg-bg min-h-screen text-white px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold pixel-font mb-2">Tu proyecto activo</h1>
        <p className="text-white/70 mb-6">Elige a qué app quieres acceder este período. Si cambias, el cambio se aplica al final de tu ciclo de facturación.</p>

        <div className="mb-4">
          <label className="block text-sm text-white/70 mb-2">Entitlement</label>
          <input value={entitlementCode} onChange={(e)=>setEntitlementCode(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2" />
          <p className="text-xs text-white/40 mt-1">Por defecto usamos <code>pos.basic</code> (Apprentice). Ajusta si tu mapping es distinto.</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-white/70 mb-2">Proyecto</label>
          <div className="grid grid-cols-2 gap-2">
            {PROJECTS.map(p => (
              <button key={p.slug} onClick={()=>setChosen(p.slug)} className={`px-4 py-2 rounded border ${chosen===p.slug ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {selection && (
          <div className="mb-6 text-sm text-white/80">
            <div>Actual: <span className="text-white">{selection.currentProject ?? '—'}</span></div>
            {selection.pendingProject && (
              <div>
                Cambio programado a <span className="text-white">{selection.pendingProject}</span> el <span className="text-white">{pendingDate}</span>
              </div>
            )}
          </div>
        )}

        {error && <div className="text-red-300 mb-4">{error}</div>}
        {message && <div className="text-emerald-300 mb-4">{message}</div>}

        <div className="flex gap-2">
          <button onClick={submit} disabled={loading} className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60">{loading ? 'Guardando…' : 'Guardar'}</button>
          <button onClick={load} className="px-4 py-2 rounded border border-white/10 bg-white/5 text-white/80">Actualizar</button>
        </div>
      </div>
    </div>
  );
}
