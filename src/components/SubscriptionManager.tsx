"use client";

import { useEffect, useMemo, useState } from 'react';
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

export default function SubscriptionManager() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState('');

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

  const trialRemaining = useMemo(() => (
    typeof data?.subscription?.trialRemainingDays === 'number'
      ? data.subscription.trialRemainingDays
      : (data?.subscription?.status === 'trialing' && daysToRenewal != null ? daysToRenewal : null)
  ), [data?.subscription?.trialRemainingDays, data?.subscription?.status, daysToRenewal]);

  const graceRemaining = useMemo(() => (
    typeof data?.subscription?.graceRemainingDays === 'number' ? data.subscription.graceRemainingDays : null
  ), [data?.subscription?.graceRemainingDays]);

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

  const hasActiveQubitoProject = useMemo(
    () => data?.entitlements.some((e) => {
      if (!['active', 'trialing', 'past_due'].includes(e.status)) return false;
      if (e.code.startsWith('qubito.')) return true;
      if (!e.code.startsWith('pos.')) return false;
      const selection = data?.selections?.find((s) => s.entitlementCode === e.code)?.selection;
      return (selection?.currentProject || '').trim().toLowerCase() === 'qubito';
    }) ?? false,
    [data]
  );

  const selectableEntitlements = useMemo(
    () => (data?.entitlements || []).filter((e) => {
      const selection = data?.selections?.find((s) => s.entitlementCode === e.code)?.selection;
      return Boolean(selection?.currentProject || selection?.pendingProject);
    }),
    [data]
  );

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

  const generateRecoveryToken = async () => {
    setRecoveryLoading(true); setError(null);
    try {
      const res = await fetch('/api/qubito/recovery-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'No se pudo generar el código');
      setRecoveryToken(j.token || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const copyRecoveryToken = async () => {
    if (!recoveryToken) return;
    try {
      await navigator.clipboard.writeText(recoveryToken);
    } catch {}
  };

  return (
    <div>
      {loading && <div className="text-white/70">Cargando…</div>}
      {error && <div className="text-red-300 mb-4">{error}</div>}

      {!loading && data && (
        <div className="space-y-6">
          <div className="rounded-lg p-4 border border-white/10 bg-white/5">
            <div className="text-sm text-white/70">Plan</div>
            <div className="text-lg font-semibold">{data.subscription?.planLabel || '—'} {data.subscription?.interval ? `(${data.subscription.interval === 'year' ? 'Anual' : 'Mensual'})` : ''}</div>
            <div className="mt-2 text-sm text-white/70">Estado: <span className="text-white">{data.subscription?.status || '—'}</span></div>
            {data.subscription?.status === 'trialing' ? (
              <div className="mt-1 text-sm text-white/70">Prueba: <span className="text-white">{trialRemaining != null ? `${trialRemaining} días restantes` : '—'}</span>{nextRenewal ? <span className="text-white/50"> {`(termina el ${nextRenewal.toLocaleDateString()})`}</span> : null}</div>
            ) : (
              <div className="mt-1 text-sm text-white/70">Próxima renovación: <span className="text-white">{nextRenewal ? nextRenewal.toLocaleDateString() : '—'}</span>{nextRenewal ? <span className="text-white/50"> {`(${daysToRenewal ?? 0} días)`}</span> : null}</div>
            )}
            {data.subscription?.status === 'past_due' && (
              <div className="mt-1 text-sm text-yellow-300">Pago pendiente: gracia restante {graceRemaining != null ? `${graceRemaining} días` : '—'}</div>
            )}
            {data.subscription ? (
              <div className="mt-3">
                <button onClick={toggleCancel} disabled={saving} className="px-3 py-2 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60">
                  {saving ? 'Guardando…' : (data.subscription.cancelAtPeriodEnd ? 'Reanudar renovación' : 'Cancelar renovación')}
                </button>
                {data.subscription.cancelAtPeriodEnd && (
                  <div className="text-xs text-white/60 mt-2">La suscripción se cancelará al finalizar el período actual.</div>
                )}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/60">No encontramos una suscripción activa vinculada a tu cuenta. Si ya compraste, espera unos segundos o <a className="underline" href="/subscribe/success">reabre el onboarding</a>.</div>
            )}
          </div>

          {selectableEntitlements.length > 0 && (
            <div className="rounded-lg p-4 border border-white/10 bg-white/5">
              <div className="font-semibold mb-2">Proyecto activo</div>
              {selectableEntitlements.map(e => {
                const sel = selectionFor(e.code);
                const msg = messageForProject(e.code);
                const disabled = saving || !canChangeProject(e.code);
                const current = sel?.currentProject || '—';
                return (
                  <div key={e.code} className="mb-5 last:mb-0">
                    <div className="text-sm text-white/70">Entitlement: <span className="text-white">{e.code}</span></div>
                    <div className="text-sm text-white/70 mb-2">Actual: <span className="text-white">{current}</span>{sel?.pendingProject ? <span className="text-white/60"> → Próximo: {sel.pendingProject}</span> : null}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PROJECTS.map(p => (
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

          {hasActiveQubitoProject && (
            <div className="rounded-lg p-4 border border-white/10 bg-white/5">
              <div className="font-semibold mb-2">Recuperación de administrador local para Qubito</div>
              <p className="text-sm text-white/70 mb-3">
                Genera un código temporal de 10 minutos y pégalo en la pantalla de login de Qubito para restablecer la contraseña del administrador local.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={generateRecoveryToken}
                  disabled={recoveryLoading}
                  className="px-3 py-2 rounded bg-sky-600 text-white font-semibold disabled:opacity-60"
                >
                  {recoveryLoading ? 'Generando…' : 'Generar código de recuperación'}
                </button>
                {recoveryToken ? (
                  <button
                    onClick={copyRecoveryToken}
                    className="px-3 py-2 rounded border border-white/20 text-white/80"
                  >
                    Copiar código
                  </button>
                ) : null}
              </div>
              {recoveryToken ? (
                <div className="mt-3">
                  <div className="text-xs text-white/50 mb-2">Este código vence en 10 minutos.</div>
                  <textarea
                    readOnly
                    value={recoveryToken}
                    className="w-full min-h-24 rounded bg-black/20 border border-white/10 px-3 py-2 text-xs text-white/80"
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
