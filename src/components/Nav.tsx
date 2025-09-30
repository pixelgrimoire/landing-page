"use client";

import Image from 'next/image';
import Link from 'next/link';
import { cls } from '@/lib/utils';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { useEffect, useMemo, useRef, useState } from 'react';

function MagicToggleButton({ magicEnabled, onClick, className }: { magicEnabled: boolean; onClick: () => void; className?: string }) {
  const [tease, setTease] = useState(false);
  const [sparks, setSparks] = useState<Array<{ id: number; left: number; top: number; dx: number; dur: number; color: string; h: number }>>([]);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seed = useRef(Math.floor(Math.random() * 10000));

  const colors = useMemo(() => ['#FACC15', '#7b00ff', '#60a5fa', '#f59e0b'], []);

  const schedule = useRef<() => void>(() => {});
  schedule.current = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = 4000 + Math.random() * 6000; // 4–10s
    timerRef.current = setTimeout(() => {
      if (!btnRef.current) return;
      // nudge
      setTease(true);
      setTimeout(() => setTease(false), 1100);
      // emit small pixel sparks
      const rect = btnRef.current.getBoundingClientRect();
      const count = 6 + Math.floor(Math.random() * 6);
      const now = performance.now ? performance.now() : Date.now();
      const batch: typeof sparks = [];
      for (let i = 0; i < count; i++) {
        const id = (seed.current + i) ^ Math.floor(now) ^ Math.floor(Math.random() * 100000);
        const left = (rect.width / 2) + (Math.random() * rect.width * 0.35 - rect.width * 0.175);
        const top = rect.height / 2 + (Math.random() * 6 - 3);
        const dx = (Math.random() * 24 - 12);
        const dur = 700 + Math.random() * 700;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const h = 24 + Math.random() * 26;
        batch.push({ id, left, top, dx, dur, color, h });
        // auto-remove spark later
        setTimeout(() => {
          setSparks((prev) => prev.filter((s) => s.id !== id));
        }, dur + 80);
      }
      setSparks((prev) => [...prev, ...batch]);
      // schedule next
      schedule.current();
    }, t);
  };

  useEffect(() => {
    if (!magicEnabled) {
      schedule.current();
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [magicEnabled]);

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={cls(
        'ml-2 text-xs sm:text-sm px-3 py-2 rounded-md border btn magic-toggle',
        magicEnabled ? 'border-yellow-400/60 text-yellow-200 hover:bg-yellow-400/10' : 'border-white/20 text-white/80 hover:bg-white/5',
        !magicEnabled ? 'is-off' : '',
        tease ? 'tease' : '',
        className || ''
      )}
      aria-pressed={magicEnabled}
      aria-label={magicEnabled ? 'Disable magic' : 'Enable magic'}
    >
      {/* sparkle layer */}
      {!magicEnabled && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
          {sparks.map((s) => (
            <span
              key={s.id}
              className="magic-spark"
              style={{ left: s.left, top: s.top, ['--dx' as any]: `${s.dx}px`, ['--dur' as any]: `${s.dur}ms`, ['--c' as any]: s.color, ['--h' as any]: `${s.h}px` }}
            />
          ))}
        </span>
      )}
      {magicEnabled ? '✨ Magic: ON' : '⛔ Magic: OFF'}
    </button>
  );
}

export default function Nav({ onToggleMagicAction, magicEnabled }: { onToggleMagicAction: () => void; magicEnabled: boolean }) {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <div className="relative glass border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <div className="w-9 h-9 grid place-content-center rounded-md bg-yellow-500/20 pixel-border">
              <Image src="/PixelGrimoire.png" alt="" width={36} height={36} className="w-7 h-7 pixelated" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="text-white font-semibold tracking-wide smooth-font">PixelGrimoire</div>
              <div className="text-white/60 text-[10px] pixel-font">where code meets magic</div>
            </div>
          </div>
          {/* Desktop navigation */}
          <div className="hidden sm:flex items-center gap-2">
            <a href="#work" className="text-white/80 hover:text-white text-xs sm:text-sm smooth-font">Work</a>
            <a href="#pricing" className="text-white/80 hover:text-white text-xs sm:text-sm smooth-font">Pricing</a>
            <a href="#tech" className="text-white/80 hover:text-white text-xs sm:text-sm smooth-font">Tech</a>
            <MagicToggleButton magicEnabled={magicEnabled} onClick={onToggleMagicAction} />
            {hasClerk ? (
              <>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="ml-2 text-xs sm:text-sm px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5">
                      Iniciar sesión
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} afterSignOutUrl="/" />
                </SignedIn>
              </>
            ) : (
              <Link href="/sign-in" className="ml-2 text-xs sm:text-sm px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5">
                Iniciar sesión
              </Link>
            )}
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-white/20 text-white/80 hover:bg-white/5"
          >
            <svg
              className={cls('transition-transform', menuOpen ? 'rotate-90' : '')}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          {/* Mobile dropdown menu */}
          <div
            className={cls(
              'sm:hidden absolute left-2 right-2 top-[calc(100%+8px)] rounded-xl border border-white/15 bg-black/60 backdrop-blur-md p-3 shadow-xl',
              'transition-all duration-200 origin-top',
              menuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
            )}
            role="menu"
            aria-hidden={!menuOpen}
          >
            <div className="flex flex-col gap-2">
              <a href="#work" onClick={closeMenu} className="px-3 py-2 rounded-md hover:bg-white/5 text-white/90 text-sm">Work</a>
              <a href="#pricing" onClick={closeMenu} className="px-3 py-2 rounded-md hover:bg-white/5 text-white/90 text-sm">Pricing</a>
              <a href="#tech" onClick={closeMenu} className="px-3 py-2 rounded-md hover:bg-white/5 text-white/90 text-sm">Tech</a>
              <MagicToggleButton
                magicEnabled={magicEnabled}
                onClick={() => { onToggleMagicAction(); closeMenu(); }}
                className="mt-1 text-sm text-left"
              />
              {hasClerk ? (
                <>
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button onClick={closeMenu} className="mt-1 text-sm px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5">
                        Iniciar sesión
                      </button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <div className="mt-1 px-1">
                      <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} afterSignOutUrl="/" />
                    </div>
                  </SignedIn>
                </>
              ) : (
                <Link href="/sign-in" onClick={closeMenu} className="mt-1 text-sm px-3 py-2 rounded-md border border-white/20 text-white/80 hover:bg-white/5">
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
