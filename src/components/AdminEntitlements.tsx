"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PROJECTS } from "@/lib/constants";

type PlanRow = { id: string; planId: string; name: string; entitlementsJson?: string | null; entitlementProjectsJson?: string | null };

export default function AdminEntitlements() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [allowed, setAllowed] = useState<Record<string, Record<string, boolean>>>({}); // planId -> { code|slug -> bool }
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/plans', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo cargar');
      setRows((data.items || []).map((r: any) => ({ id: r.id, planId: r.planId, name: r.name, entitlementsJson: r.entitlementsJson, entitlementProjectsJson: r.entitlementProjectsJson })) as PlanRow[]);
      const map: Record<string,string> = {};
      for (const r of (data.items || [])) {
        map[r.planId] = (()=>{ try { const arr = r.entitlementsJson ? JSON.parse(r.entitlementsJson) as string[] : []; return arr.join('\n'); } catch { return ''; } })();
      }
      setEditing(map);
      const allow: Record<string, Record<string, boolean>> = {};
      for (const r of (data.items || [])) {
        const per: Record<string, boolean> = {};
        try {
          const obj = r.entitlementProjectsJson ? JSON.parse(r.entitlementProjectsJson) as Record<string, string[]> : {};
          for (const code in obj) {
            const slugs = obj[code] || [];
            for (const slug of slugs) per[code + '|' + slug] = true;
          }
        } catch {}
        allow[r.planId] = per;
      }
      setAllowed(allow);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async (planId: string) => {
    setSaving(s => ({ ...s, [planId]: true })); setError(null);
    try {
      const entArr = (editing[planId] || '').split('\n').map(s=>s.trim()).filter(Boolean);
      const projMap: Record<string, string[]> = {};
      const per = allowed[planId] || {};
      for (const code of entArr) {
        const slugs = PROJECTS.map(p=>p.slug).filter(slug => !!per[code + '|' + slug]);
        if (slugs.length) projMap[code] = slugs;
      }
      const res = await fetch('/api/admin/stripe/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, entitlements: entArr, entitlementProjects: projMap }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setSaving(s => ({ ...s, [planId]: false }));
    }
  };

  if (loading && !rows) return (<div className="text-white/60">Cargando…</div>);
  if (error) return (<div className="text-red-300">{error}</div>);
  if (!rows || rows.length === 0) return (<div className="text-white/60">No hay planes. Crea uno primero.</div>);

  return (
    <div className="space-y-3">
      <div className="text-white/60 text-sm">Edita los códigos de entitlement por plan (uno por línea). Estos códigos se otorgan al activar la suscripción.</div>
      <div className="pixel-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/70">
            <tr>
              <th className="text-left p-2">Plan</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Entitlements</th>
              <th className="text-left p-2">Proyectos permitidos</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10 align-top">
                <td className="p-2 font-mono text-xs">{r.planId}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2 w-[360px]">
                  <textarea value={editing[r.planId] || ''} onChange={(e)=> setEditing(prev => ({ ...prev, [r.planId]: e.target.value }))} rows={4} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
                </td>
                <td className="p-2 w-[360px]">
                  <div className="space-y-2">
                    {(editing[r.planId] || '').split('\n').map(s=>s.trim()).filter(Boolean).map(code => (
                      <div key={code}>
                        <div className="text-xs text-white/60 mb-1">{code}</div>
                        <div className="flex flex-wrap gap-2">
                          {PROJECTS.map(p => {
                            const key = code + '|' + p.slug;
                            const checked = !!(allowed[r.planId]?.[key]);
                            return (
                              <label key={p.slug} className="flex items-center gap-1 text-xs text-white/80">
                                <input type="checkbox" checked={checked} onChange={(e)=> setAllowed(prev => { const cp = { ...(prev[r.planId] || {}) }; if (e.target.checked) cp[key] = true; else delete cp[key]; return { ...prev, [r.planId]: cp }; })} />
                                {p.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-2">
                  <button disabled={!!saving[r.planId]} onClick={()=> save(r.planId)} className="px-3 py-2 rounded-md bg-yellow-400 text-black text-sm disabled:opacity-60">{saving[r.planId] ? 'Guardando…' : 'Guardar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-white/50">Sugerencia: usa códigos estables (p.ej. pos.basic, sas.pro). Se otorgan por priceId → planId en el webhook o por fallback cuando no llega el webhook en local.</div>
    </div>
  );
}
