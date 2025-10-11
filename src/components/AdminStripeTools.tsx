"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DockPlanCard from "@/components/DockPlanCard";
import MagicPlanCard from "@/components/MagicPlanCard";

type View = 'table' | 'create' | 'edit';

type PlanRow = { id: string; planId: string; name: string; subtitle?: string | null; color?: string | null; popular?: boolean; comingSoon?: boolean; featuresJson?: string | null; entitlementsJson?: string | null; currency: string | null; priceMonthlyId: string | null; priceYearlyId: string | null; trialDays: number; graceDays: number; sortOrder?: number | null; createdAt: string; stripeProductId?: string | null };

export default function AdminStripeTools() {
  const [view, setView] = useState<View>('table');
  const [list, setList] = useState<PlanRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  // removed unused editing state

  const [planId, setPlanId] = useState("");
  const [name, setName] = useState("");
  const [productDesc, setProductDesc] = useState<string>("");
  const [productActive, setProductActive] = useState<boolean | null>(null);
  const [defaultPriceTarget, setDefaultPriceTarget] = useState<'none'|'monthly'|'yearly'>('none');
  const [subtitle, setSubtitle] = useState("");
  const [color, setColor] = useState<string>("#ffffff");
  const [popular, setPopular] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [featuresText, setFeaturesText] = useState<string>("");
  const [entitlementsText, setEntitlementsText] = useState<string>("");
  const [currency, setCurrency] = useState("usd");
  const [amountM, setAmountM] = useState<string>("");
  const [amountY, setAmountY] = useState<string>("");
  const [trial, setTrial] = useState<string>("0");
  const [grace, setGrace] = useState<string>("3");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; message?: string } | null>(null);
  const [previewM, setPreviewM] = useState<number>(0);
  const [previewY, setPreviewY] = useState<number>(0);
  const [previewYearly, setPreviewYearly] = useState(false);
  const [previewMode, setPreviewMode] = useState<'dock'|'magic'>('dock');

  // DnD state
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const canSubmit = useMemo(() => planId && name && (amountM || amountY), [planId, name, amountM, amountY]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plans');
      const data = await res.json();
      if (res.ok) setList((data.items || []) as PlanRow[]);
    } finally { setLoading(false); }
  }, []);

  const openCreate = useCallback(() => { setResult(null); setView('create'); }, []);
  const cancelCreate = useCallback(() => { setView('table'); refresh(); }, [refresh]);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true); setResult(null);
    try {
      const body: Record<string, unknown> = {
        planId: planId.trim(),
        name: name.trim(),
        currency: currency.trim() || 'usd',
        amountMonthly: amountM ? Number(amountM) : undefined,
        amountYearly: amountY ? Number(amountY) : undefined,
        trialDays: trial ? Number(trial) : 0,
        graceDays: grace ? Number(grace) : 3,
        subtitle, color, popular, comingSoon,
        features: featuresText.split('\n').map(s=>s.trim()).filter(Boolean),
        entitlements: entitlementsText.split('\n').map(s=>s.trim()).filter(Boolean),
      };
      const res = await fetch('/api/admin/stripe/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setResult({ ok: true, message: 'Plan creado y guardado en la base de datos.' });
    } catch (e: unknown) {
      setResult({ error: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }, [canSubmit, planId, name, currency, amountM, amountY, trial, subtitle, color, popular, comingSoon, featuresText, entitlementsText, grace]);

  // initial load
  useEffect(() => { refresh(); }, [refresh]);

  if (view === 'table') {
    return (
      <div className="space-y-3 text-white/90">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Planes (DB)</div>
          <button className="px-3 py-2 rounded-md bg-yellow-400 text-black text-sm" onClick={openCreate}>Crear nuevo</button>
        </div>
        <div className="pixel-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/70">
              <tr>
                <th className="text-left p-2">Plan</th>
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Moneda</th>
                <th className="text-left p-2">Price M</th>
                <th className="text-left p-2">Price Y</th>
                <th className="text-left p-2">Trial</th>
                <th className="text-left p-2">Gracia</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td className="p-2 text-white/60" colSpan={8}>Cargando…</td></tr>)}
              {!loading && (!list || list.length === 0) && (
                <tr><td className="p-2 text-white/60" colSpan={8}>Sin registros. Crea un nuevo plan.</td></tr>
              )}
              {list?.map((r, i) => (
                <tr key={r.id} draggable onDragStart={()=> setDragIndex(i)} onDragOver={(e)=> e.preventDefault()} onDrop={async()=>{
                  if (dragIndex === null || dragIndex === i || !list) return;
                  const newList = list.slice();
                  const [moved] = newList.splice(dragIndex, 1);
                  newList.splice(i, 0, moved);
                  setList(newList);
                  // persist new order (10,20,30...)
                  for (let idx = 0; idx < newList.length; idx++) {
                    const row = newList[idx];
                    const nextOrder = (idx + 1) * 10;
                    if (row.sortOrder !== nextOrder) {
                      await fetch(`/api/admin/plans?id=${encodeURIComponent(row.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: nextOrder }) });
                      row.sortOrder = nextOrder;
                    }
                  }
                  setDragIndex(null);
                }} className="border-t border-white/10">
                  <td className="p-2">{r.planId}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 uppercase">{r.currency || 'usd'}</td>
                  <td className="p-2 font-mono text-xs break-all">{r.priceMonthlyId || '—'}</td>
                  <td className="p-2 font-mono text-xs break-all">{r.priceYearlyId || '—'}</td>
                  <td className="p-2">{r.trialDays}d</td>
                  <td className="p-2">{(r as PlanRow).graceDays}d</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/5" onClick={async()=>{
                        const so = (r as unknown as { sortOrder?: number }).sortOrder;
                        const next = so ? Number(so) - 10 : 90;
                        await fetch(`/api/admin/plans?id=${encodeURIComponent(r.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: next }) });
                        refresh();
                      }}>↑</button>
                      <button className="px-2 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/5" onClick={async()=>{
                        const so = (r as unknown as { sortOrder?: number }).sortOrder;
                        const next = so ? Number(so) + 10 : 110;
                        await fetch(`/api/admin/plans?id=${encodeURIComponent(r.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: next }) });
                        refresh();
                      }}>↓</button>
                      <button className="px-2 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/5" onClick={async () => {
                        setPlanId(r.planId);
                        setName(r.name);
                        setCurrency(r.currency || 'usd');
                        setTrial(String(r.trialDays || 0));
                        setGrace(String((r as PlanRow).graceDays || 3));
                        setAmountM('');
                        setAmountY('');
                        setResult(null);
                        setDefaultPriceTarget('none');
                        setProductActive(null);
                        setProductDesc('');
                        setSubtitle(r.subtitle || '');
                        setColor(r.color || '#ffffff');
                        setPopular(!!r.popular);
                        setComingSoon(!!r.comingSoon);
                        try {
                          const arr = r.featuresJson ? JSON.parse(r.featuresJson) as string[] : [];
                          setFeaturesText(arr.join('\n'));
                        } catch { setFeaturesText(''); }
                        try {
                          const arrE = r.entitlementsJson ? JSON.parse(r.entitlementsJson) as string[] : [];
                          setEntitlementsText(arrE.join('\n'));
                        } catch { setEntitlementsText(''); }
                        if (r.stripeProductId) {
                          try {
                          const res = await fetch(`/api/admin/stripe/products?id=${encodeURIComponent(r.stripeProductId)}`);
                            const data: { name?: string; description?: string | null; active?: boolean; default_price?: string | null } = await res.json();
                            if (res.ok) {
                              setName(data.name || r.name);
                              setProductDesc(data.description || '');
                              setProductActive(typeof data.active === 'boolean' ? data.active : null);
                              if (data.default_price && (data.default_price === r.priceMonthlyId)) setDefaultPriceTarget('monthly');
                              else if (data.default_price && (data.default_price === r.priceYearlyId)) setDefaultPriceTarget('yearly');
                            }
                          } catch {}
                        }
                        setView('edit');
                        // preview amounts fallback from /api/plans
                        try {
                          const res2 = await fetch('/api/plans');
                          const data2: { items: Array<{ id: string; priceM?: number; priceY?: number }> } = await res2.json();
                          if (res2.ok && Array.isArray(data2?.items)) {
                            const found = data2.items.find((it) => it.id === r.planId);
                            if (found) { setPreviewM(found.priceM || 0); setPreviewY(found.priceY || 0); }
                          }
                        } catch {}
                      }}>Editar</button>
                      {/* Copiar env eliminado */}
                      <button className="px-2 py-1 rounded-md border border-red-400/40 text-red-300 hover:bg-red-500/10" onClick={async()=>{
                        const withArchive = confirm('¿Archivar también en Stripe (producto y precios) y borrar en DB?\nAceptar = Sí, Cancelar = solo DB');
                        const url = `/api/admin/plans?id=${encodeURIComponent(r.id)}&archiveStripe=${withArchive ? 'true' : 'false'}`;
                        await fetch(url, { method: 'DELETE' });
                        refresh();
                      }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Create / Edit view
  return (
    <div className="space-y-3 text-white/90">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{view === 'edit' ? 'Editar plan' : 'Crear plan en Stripe'}</div>
        <button className="px-3 py-1.5 rounded-md border border-white/20 text-white/80 hover:bg-white/5" onClick={cancelCreate}>Cancelar</button>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-[1fr_1fr_1.1fr] gap-3">
        <label className="text-xs">Plan ID
          <input value={planId} onChange={e=>setPlanId(e.target.value)} disabled={view==='edit'} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm disabled:opacity-60" />
        </label>
        <label className="text-xs">Nombre
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs col-span-2">Descripción (producto)
          <textarea value={productDesc} onChange={e=>setProductDesc(e.target.value)} rows={2} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={productActive ?? false} onChange={(e)=>setProductActive(e.target.checked)} />
          Producto activo
        </label>
        <label className="text-xs">Subtítulo (cards)
          <input value={subtitle} onChange={e=>setSubtitle(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">Color (cards)
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="h-8 w-8 rounded border border-white/10 bg-white/5" />
            <input value={color} onChange={e=>setColor(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
          </div>
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={popular} onChange={(e)=>setPopular(e.target.checked)} />
          Marcar como “Más popular”
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={comingSoon} onChange={(e)=>setComingSoon(e.target.checked)} />
          Próximamente (deshabilita CTAs)
        </label>
        <div className="text-xs">
          Default price
          <div className="mt-1 flex items-center gap-3 text-white/80">
            <label className="flex items-center gap-1"><input type="radio" checked={defaultPriceTarget==='none'} onChange={()=>setDefaultPriceTarget('none')} /> Ninguno</label>
            <label className="flex items-center gap-1"><input type="radio" checked={defaultPriceTarget==='monthly'} onChange={()=>setDefaultPriceTarget('monthly')} /> Mensual</label>
            <label className="flex items-center gap-1"><input type="radio" checked={defaultPriceTarget==='yearly'} onChange={()=>setDefaultPriceTarget('yearly')} /> Anual</label>
          </div>
        </div>
        <label className="text-xs">Moneda
          <input value={currency} onChange={e=>setCurrency(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">Trial (días)
          <input value={trial} onChange={e=>setTrial(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">Gracia (días)
          <input value={grace} onChange={e=>setGrace(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs col-span-2">Features (una por línea)
          <textarea value={featuresText} onChange={e=>setFeaturesText(e.target.value)} rows={4} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs col-span-2">Entitlements (códigos, uno por línea)
          <textarea value={entitlementsText} onChange={e=>setEntitlementsText(e.target.value)} rows={3} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" placeholder="pos.basic\nsas.pro" />
        </label>
        <label className="text-xs">Mensual (USD)
          <input value={amountM} onChange={e=>setAmountM(e.target.value)} placeholder={view==='edit' ? 'Dejar vacío para conservar' : ''} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">Anual (USD)
          <input value={amountY} onChange={e=>setAmountY(e.target.value)} placeholder={view==='edit' ? 'Dejar vacío para conservar' : ''} className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm" />
        </label>
        <div className="hidden xl:block">
          <div className="text-xs mb-1">Preview</div>
          <div className="border border-white/10 rounded-lg p-2 bg-black/20">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="text-white/70 text-xs">{previewYearly ? 'Anual' : 'Mensual'}</div>
              <div className="flex items-center gap-2">
                <button className={`px-2 py-1 text-xs rounded-md border border-white/15 ${previewMode==='dock' ? 'bg-white/10' : 'text-white/80 hover:bg-white/5'}`} onClick={()=>setPreviewMode('dock')}>Dock</button>
                <button className={`px-2 py-1 text-xs rounded-md border border-white/15 ${previewMode==='magic' ? 'bg-white/10' : 'text-white/80 hover:bg-white/5'}`} onClick={()=>setPreviewMode('magic')}>Magic</button>
                <button className="px-2 py-1 text-xs rounded-md border border-white/15 text-white/80 hover:bg-white/5" onClick={()=>setPreviewYearly(v=>!v)}>Toggle ciclo</button>
              </div>
            </div>
            {previewMode === 'dock' ? (
              <DockPlanCard plan={{ id: planId, name, subtitle, features: featuresText.split('\n').map(s=>s.trim()).filter(Boolean), priceM: amountM ? Number(amountM) : previewM, priceY: amountY ? Number(amountY) : previewY, popular, comingSoon, color }} yearly={previewYearly} onSubscribeAction={()=>{}} />
            ) : (
              <div className="max-w-sm">
                <MagicPlanCard plan={{ id: planId, name, subtitle, features: featuresText.split('\n').map(s=>s.trim()).filter(Boolean), priceM: amountM ? Number(amountM) : previewM, priceY: amountY ? Number(amountY) : previewY, popular, comingSoon, color }} yearly={previewYearly} onSubscribeAction={()=>{}} />
              </div>
            )}
          </div>
        </div>
      </div>
      {view === 'edit' ? (
        <button disabled={busy || !name} onClick={async()=>{
          setBusy(true); setResult(null);
          try {
            const featuresArr = featuresText.split('\n').map(s=>s.trim()).filter(Boolean);
            const entArr = entitlementsText.split('\n').map(s=>s.trim()).filter(Boolean);
            const body: Record<string, unknown> = { planId, name, currency, trialDays: Number(trial) || 0, graceDays: Number(grace) || 3, subtitle, color, popular, comingSoon, features: featuresArr, entitlements: entArr };
            if (amountM) body.amountMonthly = Number(amountM);
            if (amountY) body.amountYearly = Number(amountY);
            if (productActive !== null) body.productActive = productActive;
            if (productDesc) body.productDescription = productDesc;
            if (defaultPriceTarget) body.defaultPriceTarget = defaultPriceTarget;
            const res = await fetch('/api/admin/stripe/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Error');
            setResult({ ok: true, message: 'Cambios guardados.' });
            refresh();
          } catch (e: unknown) { setResult({ error: e instanceof Error ? e.message : 'Unknown error' }); }
          finally { setBusy(false); }
        }} className="w-full px-3 py-2 rounded-md bg-yellow-400 text-black text-sm disabled:opacity-60">{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      ) : (
        <button disabled={!canSubmit || busy} onClick={submit} className="w-full px-3 py-2 rounded-md bg-yellow-400 text-black text-sm disabled:opacity-60">{busy ? 'Creando…' : 'Crear Producto + Prices'}</button>
      )}
      {view === 'edit' && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5 text-sm" onClick={async()=>{
            if (!planId) return;
            const res = await fetch('/api/admin/stripe/migrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, target: 'monthly' }) });
            const data = await res.json();
            setResult(res.ok ? { ok: true } : { error: data?.error || 'Error' });
          }}>Migrar subs activas → Mensual</button>
          <button className="px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5 text-sm" onClick={async()=>{
            if (!planId) return;
            const res = await fetch('/api/admin/stripe/migrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, target: 'yearly' }) });
            const data = await res.json();
            setResult(res.ok ? { ok: true } : { error: data?.error || 'Error' });
          }}>Migrar subs activas → Anual</button>
        </div>
      )}
      {result?.ok && (
        <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">{result.message || 'Listo.'}</div>
      )}
      {result?.error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded p-2">{result.error}</div>
      )}
      <div className="text-[11px] text-white/50">Solo admins (rol Clerk <code>admin</code>). La configuración se guarda en la base de datos.</div>
    </div>
  );
}
