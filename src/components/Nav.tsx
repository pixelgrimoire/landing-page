'use client';

import Image from 'next/image';
import { cls } from '@/lib/utils';

export default function Nav({ onToggleMagicAction, magicEnabled }: { onToggleMagicAction: () => void; magicEnabled: boolean }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <div className="glass border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <div className="w-9 h-9 grid place-content-center rounded-md bg-yellow-500/20 pixel-border">
              <Image src="/PixelGrimoire.png" alt="" width={36} height={36} className="w-7 h-7 pixelated" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="text-white font-semibold tracking-wide smooth-font">PixelGrimoire</div>
              <div className="text-white/60 text-[10px] pixel-font">where code meets magic</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="#work" className="text-white/80 hover:text-white text-xs sm:text-sm smooth-font">Work</a>
            <a href="#pricing" className="text-white/80 hover:text-white text-xs sm:text-sm smooth-font">Pricing</a>
            <a href="#tech" className="text-white/80 hover:text-white text-xs sm:text-sm smooth-font">Tech</a>
            <button onClick={onToggleMagicAction} className={cls('ml-2 text-xs sm:text-sm px-3 py-2 rounded-md border btn',
              magicEnabled ? 'border-yellow-400/60 text-yellow-200 hover:bg-yellow-400/10' : 'border-white/20 text-white/80 hover:bg-white/5')}>
              {magicEnabled ? '✨ Magic: ON' : '⛔ Magic: OFF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
