"use client";

import Image from 'next/image';
import Link from 'next/link';
import { cls } from '@/lib/utils';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/nextjs';
import SubscriptionManager from '@/components/SubscriptionManager';
import AdminPanel from '@/components/AdminPanel';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

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
          {sparks.map((s) => {
            type SparkStyle = CSSProperties & { ['--dx']?: string; ['--dur']?: string; ['--c']?: string; ['--h']?: string };
            const sparkStyle: SparkStyle = { left: s.left, top: s.top, '--dx': `${s.dx}px`, '--dur': `${s.dur}ms`, '--c': s.color, '--h': `${s.h}px` };
            return (
              <span key={s.id} className="magic-spark" style={sparkStyle} />
            );
          })}
        </span>
      )}
      {magicEnabled ? '✨ Magic: ON' : '⛔ Magic: OFF'}
    </button>
  );
}

export default function Nav({ onToggleMagicAction, magicEnabled }: { onToggleMagicAction: () => void; magicEnabled: boolean }) {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const { user } = useUser();
  const isAdmin = useMemo(() => {
    try {
      const primary = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
      const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      return !!primary && list.includes(primary.toLowerCase());
    } catch { return false; }
  }, [user?.primaryEmailAddress?.emailAddress, user?.emailAddresses]);

  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <div className="relative glass border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <div className={`w-9 h-9 grid place-content-center rounded-md ${magicEnabled ? 'bg-yellow-500/20' : ''} pixel-border`}>
              {magicEnabled ? (
              <Image src="/PixelGrimoire.png" alt="" width={36} height={36} className="w-7 h-7 pixelated" aria-hidden />
                ) : (
                <Image src="/Logo Pixel Grimoire Simple.svg" alt="" width={72} height={72} className="w-24 h-24" aria-hidden />
                )}
            </div>
            <div className="leading-tight">
              <div className="text-white font-semibold tracking-wide smooth-font">PixelGrimoire</div>
              <div className="text-white/60 text-[10px] pixel-font">donde el código se encuentra con la magia</div>
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
                  <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} afterSignOutUrl="/">
                    {/* Fallback/custom modal pages if running in modal mode */}
                    <UserButton.UserProfilePage label="Suscripción" url="subscription" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>}>
                      <div className="p-3 min-w-[280px]">
                        <SubscriptionManager />
                      </div>
                    </UserButton.UserProfilePage>
                    {/* Reorder defaults explicitly if needed */}
                    <UserButton.UserProfilePage label="account" />
                    <UserButton.UserProfilePage label="security" />
                  </UserButton>
                  {isAdmin && (
                    <button
                      type="button"
                      aria-label="Abrir admin"
                      onClick={() => setAdminOpen(true)}
                      className="ml-2 inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/20 text-white/80 hover:bg-white/5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16">
                        <g fill="none">
                          <g clipPath="url(#gravityUiGear0)">
                            <path
                              fill="#ffffff"
                              fillRule="evenodd"
                              d="M7.199 2H8.8a.2.2 0 0 1 .2.2c0 1.808 1.958 2.939 3.524 2.034a.199.199 0 0 1 .271.073l.802 1.388a.199.199 0 0 1-.073.272c-1.566.904-1.566 3.164 0 4.069a.199.199 0 0 1 .073.271l-.802 1.388a.199.199 0 0 1-.271.073C10.958 10.863 9 11.993 9 13.8a.2.2 0 0 1-.199.2H7.2a.199.199 0 0 1-.2-.2c0-1.808-1.958-2.938-3.524-2.034a.199.199 0 0 1-.272-.073l-.8-1.388a.199.199 0 0 1 .072-.271c1.566-.905 1.566-3.165 0-4.07a.199.199 0 0 1-.073-.271l.801-1.388a.199.199 0 0 1 .272-.073C5.042 5.138 7 4.007 7 2.2c0-.11.089-.199.199-.199ZM5.5 2.2c0-.94.76-1.7 1.699-1.7H8.8c.94 0 1.7.76 1.7 1.7a.85.85 0 0 0 1.274.735a1.699 1.699 0 0 1 2.32.622l.802 1.388c.469.813.19 1.851-.622 2.32a.85.85 0 0 0 0 1.472a1.7 1.7 0 0 1 .622 2.32l-.802 1.388a1.699 1.699 0 0 1-2.32.622a.85.85 0 0 0-1.274.735c0 .939-.76 1.7-1.699 1.7H7.2a1.7 1.7 0 0 1-1.699-1.7a.85.85 0 0 0-1.274-.735a1.698 1.698 0 0 1-2.32-.622l-.802-1.388a1.699 1.699 0 0 1 .622-2.32a.85.85 0 0 0 0-1.471a1.699 1.699 0 0 1-.622-2.321l.801-1.388a1.699 1.699 0 0 1 2.32-.622A.85.85 0 0 0 5.5 2.2m4 5.8a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0M11 8a3 3 0 1 1-6 0a3 3 0 0 1 6 0"
                              clipRule="evenodd"
                            />
                          </g>
                          <defs>
                            <clipPath id="gravityUiGear0">
                              <path fill="#000000" d="M0 0h16v16H0z" />
                            </clipPath>
                          </defs>
                        </g>
                      </svg>
                    </button>
                  )}
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
                      <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} afterSignOutUrl="/">
                        <UserButton.UserProfilePage label="Suscripción" url="subscription" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>}>
                          <div className="p-3 min-w-[280px]">
                            <SubscriptionManager />
                          </div>
                        </UserButton.UserProfilePage>
                        <UserButton.UserProfilePage label="account" />
                        <UserButton.UserProfilePage label="security" />
                      </UserButton>
                      {isAdmin && (
                        <button
                          type="button"
                          aria-label="Abrir admin"
                          onClick={() => { setAdminOpen(true); closeMenu(); }}
                          className="mt-2 inline-flex items-center justify-center w-full rounded-md border border-white/20 text-white/80 hover:bg-white/5 px-3 py-2"
                        >
                          <span className="mr-2">⚙</span> Admin
                        </button>
                      )}
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
      {adminOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setAdminOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative w-full max-w-7xl h-[88vh] rounded-xl border border-white/10 bg-white/[.02] shadow-2xl backdrop-blur-md pixel-border overflow-hidden">
              <button aria-label="Cerrar" onClick={() => setAdminOpen(false)} className="pixel-close-btn -top-5 -right-5 z-20"><span className="btn-face" /></button>
              <div className="p-4 sm:p-6 h-full overflow-auto">
                <h3 className="text-white font-bold smooth-font mb-4">Administración</h3>
                <AdminPanel />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
