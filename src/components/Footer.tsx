'use client';

import { useEffect, useState } from 'react';
import { MAIL_TO } from '@/lib/constants';

export default function Footer() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pg_email') || '' : '';
    if (stored) setEmail(stored);
  }, []);

  const onChange = (v: string) => {
    setEmail(v);
    try { localStorage.setItem('pg_email', v); } catch {}
  };

  const supportHref = () => {
    const subject = encodeURIComponent('PixelGrimoire — Soporte');
    const body = encodeURIComponent(`Email: ${email || '(escribe aquí)'}\nMensaje: `);
    return `${MAIL_TO}?subject=${subject}&body=${body}`;
  };

  return (
    <footer className="py-10 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-4 text-white/60 text-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="pixel-font text-[10px]">© {new Date().getFullYear()} PixelGrimoire</div>
          <div className="flex gap-4">
            <a className="hover:text-white" href="https://github.com/pixelgrimoire" target="_blank" rel="noreferrer">GitHub</a>
            <a className="hover:text-white" href="https://linkedin.com/company/pixelgrimoire" target="_blank" rel="noreferrer">LinkedIn</a>
            <a className="hover:text-white" href="https://twitter.com/PixelGrimoireHQ" target="_blank" rel="noreferrer">X/Twitter</a>
          </div>
        </div>

        {/* Email + Soporte */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="w-full sm:w-auto flex-1">
            <input
              value={email}
              onChange={e=>onChange(e.target.value)}
              placeholder="tu@email"
              className="w-full sm:w-80 px-3 py-2 rounded-md border border-white/20 bg-transparent text-white placeholder-white/40 outline-none"
            />
          </div>
          <div>
            <a href={supportHref()} className="px-4 py-2 rounded-md bg-yellow-400 text-black font-semibold pixel-font">Soporte</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
