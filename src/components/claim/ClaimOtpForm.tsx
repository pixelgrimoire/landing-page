'use client';
import { useEffect, useState } from 'react';

export default function ClaimOtpForm({ token, emailMasked }: { token: string; emailMasked?: string }) {
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/claim/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el código');
      setSent(true);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || 'No se pudo enviar');
    } finally {
      setLoading(false);
    }
  };

  // Auto-enviar OTP al montar
  useEffect(() => {
    if (!sent) {
      void send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/claim/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, otp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Código inválido');
      window.location.href = `/register?token=${encodeURIComponent(token)}`;
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 rounded border border-white/10 bg-white/5 mt-16">
      <h1 className="text-xl font-bold mb-4">Reclamar compra con código</h1>
      <p className="mb-2 text-white/80">Te enviamos un código al correo usado en la compra para verificar que eres el titular.</p>
      {emailMasked && <p className="mb-4 text-white/60">Correo: <span className="font-mono">{emailMasked}</span></p>}
      {!sent ? (
        <button disabled={loading} onClick={send} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/10">{loading ? 'Enviando…' : 'Enviar código'}</button>
      ) : (
        <div className="space-y-3">
          <input className="w-full px-3 py-2 rounded bg-black/30 border border-white/10" placeholder="Código de 6 dígitos" value={otp} onChange={(e)=>setOtp(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={loading} onClick={verify} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/10">Verificar</button>
            <button disabled={loading} onClick={send} className="px-4 py-2 rounded border border-white/10">Reenviar</button>
          </div>
          <p className="text-white/50 text-sm">Revisa tu carpeta de spam o notificaciones.</p>
        </div>
      )}
      {error && <p className="text-red-400 mt-3">{error}</p>}
    </div>
  );
}
