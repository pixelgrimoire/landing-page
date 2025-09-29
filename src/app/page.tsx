'use client';

import { useEffect, useState } from 'react';
import GlobalStyle from '@/components/GlobalStyle';
import Nav from '@/components/Nav';
import CursorTrail from '@/components/CursorTrail';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Work from '@/components/Work';
import Subscriptions from '@/components/Subscriptions';
import Tech from '@/components/Tech';
import Footer from '@/components/Footer';
import RuneEmitter from '@/components/RuneEmitter';
import Starfield from '@/components/Starfield';
import Cloudfield from '@/components/Cloudfield';

export default function PixelGrimoireLanding() {
  const [magicEnabled, setMagicEnabled] = useState(true);
  // Persist toggle across visits (on mount)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pg_magic');
      if (saved === 'off') setMagicEnabled(false);
    } catch {}
  }, []);
  return (
    <div className="pg-bg min-h-screen text-white relative overflow-x-clip transition-colors duration-500" data-magic={magicEnabled ? 'on' : 'off'}>
      <GlobalStyle />
      <Nav magicEnabled={magicEnabled} onToggleMagicAction={() => {
        setMagicEnabled(v => {
          const next = !v; try { localStorage.setItem('pg_magic', next ? 'on' : 'off'); } catch {}
          return next;
        });
      }} />
      <CursorTrail enabled={magicEnabled} />
      {/* Runas globales detrás de todo el contenido */}
      <RuneEmitter enabled={magicEnabled} />

      {/* Fondo estelar global (si quieres que siga siendo global, déjalo, si no, quítalo) */}
      <div className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 ${magicEnabled ? 'opacity-100' : 'opacity-0'}`}>
        <Starfield enabled={magicEnabled} />
      </div>

      <main className="pt-24 relative z-10">
        <Hero magicEnabled={magicEnabled} />
        {/* Cloudfield entre Hero y Features */}
        <div className={`relative w-full h-[28vh] sm:h-[32vh] md:h-[38vh] lg:h-[42vh] xl:h-[48vh] -mt-100 -mb-30 z-0 pointer-events-none overflow-hidden transition-opacity duration-500 ${magicEnabled ? 'opacity-100' : 'opacity-0'}`}>
          <Cloudfield enabled={magicEnabled} />
        </div>
        <Features />
        <Work magicEnabled={magicEnabled} />
        <Subscriptions magicEnabled={magicEnabled} />
        <Tech />
      </main>
      <Footer />
    </div>
  );
}
