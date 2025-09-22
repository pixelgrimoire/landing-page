'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn('credentials', { email, name, callbackUrl: '/', redirect: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <form onSubmit={handle} className="w-full max-w-sm space-y-4 p-6 rounded border border-white/10 bg-white/5">
        <h1 className="text-xl font-bold">Iniciar sesión (dev)</h1>
        <input className="w-full px-3 py-2 rounded bg-black/30 border border-white/10" type="email" placeholder="email@dominio.com" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="w-full px-3 py-2 rounded bg-black/30 border border-white/10" type="text" placeholder="Tu nombre (opcional)" value={name} onChange={e=>setName(e.target.value)} />
        <button disabled={loading} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/10">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

