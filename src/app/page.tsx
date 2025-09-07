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

export default function PixelGrimoireLanding() {
  const [magicEnabled, setMagicEnabled] = useState(true);
  return (
    <div className="pg-bg min-h-screen text-white relative overflow-x-clip">
      <GlobalStyle />
      <Nav magicEnabled={magicEnabled} onToggleMagicAction={() => setMagicEnabled(v => !v)} />
      <CursorTrail enabled={magicEnabled} />
      {/* Runas globales detrás de todo el contenido */}
      <RuneEmitter enabled={magicEnabled} />
      <main className="pt-24">
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
