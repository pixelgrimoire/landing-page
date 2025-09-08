'use client';

import { useState } from 'react';
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
  return (
    <div className="pg-bg min-h-screen text-white relative overflow-x-clip">
      <GlobalStyle />
      <Nav magicEnabled={magicEnabled} onToggleMagicAction={() => setMagicEnabled(v => !v)} />
      <CursorTrail enabled={magicEnabled} />
      {/* Runas globales detrás de todo el contenido */}
      <RuneEmitter enabled={magicEnabled} />

      {/* Fondo estelar global */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Starfield enabled={magicEnabled} />
      </div>
      {/* Nubes globales ancladas abajo, altura responsive */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-[28vh] sm:h-[32vh] md:h-[38vh] lg:h-[42vh] xl:h-[48vh] z-0 overflow-hidden">
        <Cloudfield enabled={magicEnabled} />
      </div>

      <main className="pt-24 relative z-10">
        <Hero magicEnabled={magicEnabled} />
        <Features />
        <Work />
        <Subscriptions />
        <Tech />
      </main>
      <Footer />
    </div>
  );
}
