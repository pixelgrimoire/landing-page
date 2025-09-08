'use client';

import Image from 'next/image';
import MagicCircle from '@/components/MagicCircle';
import BlueFlames from '@/components/BlueFlames';
import { MAIL_TO } from '@/lib/constants';

export default function Hero({ magicEnabled }: { magicEnabled: boolean }) {
  return (
    <section className="relative min-h-[92vh] flex items-center">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="fade-up text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-100 to-white smooth-font">
            Conjura tu software
          </h1>
          <p className="fade-up mt-5 text-white/80 leading-relaxed max-w-xl smooth-font" style={{animationDelay:'120ms'}}>
            PixelGrimoire combina <strong className="text-white">Next.js</strong>, buen diseño y un toque de hechicería visual para crear experiencias que funcionan… y deslumbran.
          </p>
          <div className="fade-up mt-8 flex gap-3" style={{animationDelay:'260ms'}}>
            <a href={MAIL_TO} className="relative inline-flex items-center justify-center px-5 py-3 rounded-md bg-gradient-to-b from-yellow-400 to-yellow-500 text-black font-semibold hover:brightness-110 transition">✉️ Contacto</a>
            <a href="#pricing" className="px-5 py-3 rounded-md border border-white/20 text-white/90 hover:bg-white/5 transition">★ Planes</a>
          </div>
        </div>

        <div className="relative fade-up" style={{animationDelay:'140ms'}}>
          <div className="relative mx-auto max-w-[520px] rounded-xl p-4 glass">
            <div className="relative float-slow">
              <div className="absolute -inset-10 -z-10 blur-3xl opacity-30" style={{background:'conic-gradient(from 0deg, #FACC15, #2563EB, #6B21A8, #FACC15)'}}/>
                <BlueFlames enabled={magicEnabled} />
                <Image
                  src="/PixelGrimoireSimple.png"
                  alt="Grimorio abierto con runas"
                  width={1024}
                  height={1024}
                  priority
                  sizes="(max-width: 640px) 100vw, 520px"
                  className="relative z-10 w-full h-auto select-none"
                />
              </div>
            <MagicCircle enabled={magicEnabled} />
          </div>
        </div>
      </div>
    </section>
  );
}
