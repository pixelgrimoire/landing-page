"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PROJECTS } from '@/lib/constants';

type Selection = { entitlementCode: string; selection: { currentProject?: string | null; pendingProject?: string | null; pendingEffectiveAt?: string | null } | null };

type ApiData = {
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    planId: string | null;
    planLabel: string | null;
    interval: 'month'|'year'|null;
    trialDays?: number | null;
    graceDays?: number | null;
    trialRemainingDays?: number | null;
    graceRemainingDays?: number | null;
  } | null;
  entitlements: Array<{ code: string; currentPeriodEnd: string | null; status: string }>;
  selections: Selection[];
};

export default function SubscriptionAccountPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [allowedMap, setAllowedMap] = useState<Record<string, string[]>>({});

  const nextRenewal = useMemo(() => {
    const iso = data?.subscription?.currentPeriodEnd;
    if (!iso) return null;
    try { return new Date(iso); } catch { return null; }
  }, [data?.subscription?.currentPeriodEnd]);

  const daysToRenewal = useMemo(() => {
    if (!nextRenewal) return null;
    const ms = +nextRenewal - Date.now();
    return Math.max(0, Math.ceil(ms / (1000*60*60*24)));
  }, [nextRenewal]);

  const trialRemaining = useMemo(() => {
    return typeof data?.subscription?.trialRemainingDays === 'number' ? data.subscription.trialRemainingDays : (data?.subscription?.status === 'trialing' && daysToRenewal != null ? daysToRenewal : null);
  }, [data?.subscription?.trialRemainingDays, data?.subscription?.status, daysToRenewal]);

  const graceRemaining = useMemo(() => {
    return typeof data?.subscription?.graceRemainingDays === 'number' ? data.subscription.graceRemainingDays : null;
  }, [data?.subscription?.graceRemainingDays]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/account/subscription', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudo cargar');
      setData(json as ApiData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/entitlements/allowed', { cache: 'no-store' }); const d = await r.json(); if (r.ok && d?.map) setAllowedMap(d.map as Record<string,string[]>); } catch {}
    })();
  }, []);

  const toggleCancel = async () => {
    if (!data?.subscription) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/account/subscription/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelAtPeriodEnd: !data.subscription.cancelAtPeriodEnd }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo actualizar');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally { setSaving(false); }
  };

  const selectionFor = (code: string) => data?.selections?.find(s => s.entitlementCode === code)?.selection || null;

  const canChangeProject = (code: string) => {
    const sel = selectionFor(code);
    // Solo habilitado si ya pasó la renovación
    if ((daysToRenewal ?? 0) > 0) return false;
    if (!sel) return true;
    if (sel.pendingProject && sel.pendingEffectiveAt) {
      try { return new Date(sel.pendingEffectiveAt) <= new Date(); } catch { return false; }
    }
    return true;
  };

  const messageForProject = (code: string) => {
    const sel = selectionFor(code);
    if (sel?.pendingProject && sel?.pendingEffectiveAt) {
      const d = new Date(sel.pendingEffectiveAt);
      const days = Math.max(0, Math.ceil((+d - Date.now()) / (1000*60*60*24)));
      return days > 0 ? `Podrás cambiar de proyecto en ${days} día${days===1?'':'s'} (al renovarse).` : 'El cambio se aplicará ahora.';
    }
    if (!canChangeProject(code) || (daysToRenewal ?? 0) > 0) {
      const days = daysToRenewal ?? 0;
      return days > 0 ? `Podrás cambiar de proyecto tras tu renovación en ${days} día${days===1?'':'s'}.` : '';
    }
    return '';
  };

  const selectProject = async (code: string, project: string) => {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/projects/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entitlementCode: code, project }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo guardar');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally { setSaving(false); }
  };

  return (
    <div className="pg-bg min-h-screen text-white px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold pixel-font">Tu suscripción</h1>
          <Link href="/" className="text-white/70 hover:text-white text-sm">Inicio</Link>
        </div>

        {loading && <div className="text-white/70">Cargando…</div>}
        {error && <div className="text-red-300 mb-4">{error}</div>}

        {!loading && data && (
          <div className="space-y-6">
            <div className="pixel-border rounded-lg p-4">
              <div className="text-sm text-white/70">Plan</div>
              <div className="text-lg font-semibold">{data.subscription?.planLabel || '—'} {data.subscription?.interval ? `(${data.subscription.interval === 'year' ? 'Anual' : 'Mensual'})` : ''}</div>
              <div className="mt-2 text-sm text-white/70">Estado: <span className="text-white">{data.subscription?.status || '—'}</span></div>
              {data.subscription?.status === 'trialing' ? (
                <div className="mt-1 text-sm text-white/70">Prueba: <span className="text-white">{trialRemaining != null ? `${trialRemaining} días restantes` : '—'}</span>{nextRenewal ? <span className="text-white/50"> {`(termina el ${nextRenewal.toLocaleDateString()})`}</span> : null}</div>
              ) : (
                <div className="mt-1 text-sm text-white/70">Próxima renovación: <span className="text-white">{nextRenewal ? nextRenewal.toLocaleDateString() : '—'}</span>{daysToRenewal!=null ? <span className="text-white/50"> {`(${daysToRenewal} días)`}</span> : null}</div>
              )}
              {data.subscription?.status === 'past_due' && (
                <div className="mt-1 text-sm text-yellow-300">Pago pendiente: gracia restante {graceRemaining != null ? `${graceRemaining} días` : '—'}</div>
              )}
              <div className="mt-3">
                <button onClick={toggleCancel} disabled={saving || !data.subscription} className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60">
                  {saving ? 'Guardando…' : (data.subscription?.cancelAtPeriodEnd ? 'Reanudar renovación' : 'Cancelar renovación')}
                </button>
                {data.subscription?.cancelAtPeriodEnd && (
                  <div className="text-xs text-white/60 mt-2">La suscripción se cancelará al finalizar el período actual.</div>
                )}
              </div>
            </div>

            {data.entitlements.length > 0 && (
              <div className="pixel-border rounded-lg p-4">
                <div className="font-semibold mb-2">Proyecto activo</div>
                {data.entitlements.map(e => {
                  const sel = selectionFor(e.code);
                  const msg = messageForProject(e.code);
                  const disabled = saving || !canChangeProject(e.code);
                  const current = sel?.currentProject || '—';
                  return (
                    <div key={e.code} className="mb-5 last:mb-0">
                      <div className="text-sm text-white/70">Entitlement: <span className="text-white">{e.code}</span></div>
                      <div className="text-sm text-white/70 mb-2">Actual: <span className="text-white">{current}</span>{sel?.pendingProject ? <span className="text-white/60"> → Próximo: {sel.pendingProject}</span> : null}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(allowedMap[e.code] ? PROJECTS.filter(p => allowedMap[e.code].includes(p.slug)) : PROJECTS).map(p => (
                          <button key={p.slug} onClick={() => selectProject(e.code, p.slug)} disabled={disabled}
                            className={`px-3 py-2 rounded border ${current===p.slug ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'} disabled:opacity-60`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                      {msg && <div className="text-[11px] text-white/60 mt-2">{msg}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
