"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

export type SnesSceneMode = "tiles" | "wipe" | "runes" | "iris";

export type SnesSceneTransitionHandle = {
  play: (opts?: {
    mode?: SnesSceneMode;
    onMidway?: () => void;
    onComplete?: () => void;
    duration?: number;
    // For runes mode: direction of energy
    variant?: "explode" | "implode";
  }) => gsap.core.Timeline | undefined;
};

export type SnesSceneTransitionProps = {
  tileCols?: number;
  tileRows?: number;
  duration?: number;
  palette?: string[];
  scanlines?: boolean;
  easing?: string;
  className?: string;
  debug?: boolean;
};

const makeArray = (n: number) => Array.from({ length: n }, (_, i) => i);
const defaultPalette = ["#0b0f17", "#121a2a", "#1b2240", "#3a2e73", "#7b00ff"];

// Ensure SSR/CSR parity for SVG geometry to avoid hydration mismatches
const r4 = (n: number) => Number(n.toFixed(4));

function buildTilesTimeline(
  wrapEl: HTMLDivElement,
  cols: number,
  rows: number,
  duration: number,
  easing: string,
  onMidway?: () => void
) {
  const nodes = Array.from(wrapEl.children) as HTMLElement[];
  const tl = gsap.timeline({ defaults: { ease: easing } });

  tl.set(wrapEl, { display: "grid" });
  tl.set(nodes, { scaleY: 0, transformOrigin: "50% 50%" });

  // Cover
  tl.to(nodes, {
    scaleY: 1,
    duration: duration / 2,
    stagger: { grid: [rows, cols], from: "center", amount: duration * 0.4 },
  });

  // Switch scene exactly halfway
  tl.add(() => onMidway?.());

  // Reveal
  tl.to(nodes, {
    scaleY: 0,
    duration: duration / 2,
    stagger: { grid: [rows, cols], from: "random", amount: duration * 0.35 },
  });

  tl.add(() => { gsap.set(wrapEl, { display: "none" }); });

  return tl;
}

function buildWipeTimeline(
  wipeRoot: HTMLDivElement,
  barEl: HTMLDivElement,
  duration: number,
  easing: string,
  onMidway?: () => void
) {
  const tl = gsap.timeline({ defaults: { ease: easing } });
  tl.set(wipeRoot, { display: "block" });
  tl.set(barEl, { scaleX: 0, transformOrigin: "left center" });

  // Cover
  tl.to(barEl, { scaleX: 1, duration: duration / 2 });
  tl.add(() => onMidway?.());
  // Reveal
  tl.set(barEl, { transformOrigin: "right center" });
  tl.to(barEl, { scaleX: 0, duration: duration / 2 });

  tl.add(() => { gsap.set(wipeRoot, { display: "none" }); });
  return tl;
}

function buildRunesTimeline(
  root: HTMLDivElement,
  veil: HTMLDivElement,
  rune: HTMLDivElement,
  flash: HTMLDivElement,
  shardsWrap: HTMLDivElement,
  duration: number,
  easing: string,
  variant: "explode" | "implode",
  onMidway?: () => void
) {
  const tl = gsap.timeline({ defaults: { ease: easing } });

  const shards = Array.from(shardsWrap.children) as HTMLElement[];
  tl.set(root, { display: "flex" });
  tl.set([veil, flash], { autoAlpha: 0 });
  tl.set(rune, { opacity: 0, scale: 0.85, rotate: 0 });
  const randX = () => gsap.utils.random(-window.innerWidth * 0.6, window.innerWidth * 0.6);
  const randY = () => gsap.utils.random(-window.innerHeight * 0.5, window.innerHeight * 0.5);
  tl.set(shards, {
    opacity: variant === "implode" ? 1 : 0,
    scale: variant === "implode" ? 1 : 0.6,
    x: variant === "implode" ? () => randX() : 0,
    y: variant === "implode" ? () => randY() : 0,
    rotate: () => gsap.utils.random(-180, 180),
  });

  // Cover quickly with veil and bring in the rune seal
  tl.to(veil, { autoAlpha: 1, duration: Math.max(0.12, duration * 0.1) });
  tl.to(
    rune,
    { opacity: 1, scale: 1, duration: Math.max(0.28, duration * 0.25), ease: "back.out(1.6)" },
    "<"
  );
  // Subtle idle motion
  tl.to(rune, { rotate: 8, duration: duration * 0.2, yoyo: true, repeat: 1, ease: "sine.inOut" }, "<");

  if (variant === "explode") {
    // Midway early: flash and switch to Magic ON so fondo aparece bajo el estallido
    tl.add(() => {
      gsap.to(flash, { autoAlpha: 1, duration: 0.1, ease: "power4.out" });
    });
    tl.add(() => onMidway?.());
    tl.to(flash, { autoAlpha: 0, duration: 0.2, ease: "power2.in" });

    // Burst outward and fade slightly
    tl.to(
      shards,
      {
        opacity: 1,
        scale: 1,
        duration: Math.max(0.4, duration * 0.35),
        stagger: { amount: duration * 0.15, from: "center" },
        x: () => randX(),
        y: () => randY(),
        rotate: () => gsap.utils.random(-180, 180),
        ease: "expo.out",
      },
      "<0.02"
    );
  } else {
    // Implode: shards fly IN toward the seal, then switch scene
    tl.to(
      shards,
      {
        opacity: 1,
        scale: 0.6,
        duration: Math.max(0.45, duration * 0.4),
        stagger: { amount: duration * 0.18, from: "edges" },
        x: 0,
        y: 0,
        rotate: 0,
        ease: "expo.in",
      },
      ">-0.05"
    );
    // Flash and switch to Magic OFF after absorption
    tl.add(() => { gsap.to(flash, { autoAlpha: 1, duration: 0.08, ease: "power4.out" }); });
    tl.add(() => onMidway?.());
    tl.to(flash, { autoAlpha: 0, duration: 0.18, ease: "power2.in" });
  }

  // Fade everything away, drop the veil last
  tl.to(rune, { opacity: 0, duration: 0.25 }, "-=0.2");
  tl.to(shards, { opacity: 0, duration: 0.25 }, "-=0.1");
  tl.to(veil, { autoAlpha: 0, duration: Math.max(0.18, duration * 0.15) });

  tl.add(() => {
    gsap.set(root, { display: "none" });
  });

  return tl;
}

function buildIrisTimeline(
  root: HTMLDivElement,
  disc: HTMLDivElement,
  duration: number,
  easing: string,
  onMidway?: () => void
) {
  const tl = gsap.timeline({ defaults: { ease: easing } });
  tl.set(root, { display: "block" });
  tl.set(disc, { scale: 0, opacity: 1, transformOrigin: "50% 50%" });

  // Close iris (cover)
  tl.to(disc, { scale: 6.0, duration: duration / 2, ease: "power3.in" });
  tl.add(() => onMidway?.());
  // Open iris (reveal)
  tl.to(disc, { scale: 0, duration: duration / 2, ease: "power3.out" });

  tl.add(() => { gsap.set(root, { display: "none" }); });
  return tl;
}

export const SnesSceneTransition = React.forwardRef<SnesSceneTransitionHandle, SnesSceneTransitionProps>(
  (
    {
      tileCols = 24,
      tileRows = 14,
      duration = 1.2,
      palette = defaultPalette,
      scanlines = false,
      className = "",
      easing = "power2.inOut",
      debug = false,
    },
    ref
  ) => {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const tilesWrapRef = useRef<HTMLDivElement | null>(null);
    const wipeRef = useRef<HTMLDivElement | null>(null);
    const wipeBarRef = useRef<HTMLDivElement | null>(null);
    // Runes mode
    const runesRootRef = useRef<HTMLDivElement | null>(null);
    const runesVeilRef = useRef<HTMLDivElement | null>(null);
    const runeSealRef = useRef<HTMLDivElement | null>(null);
    const flashRef = useRef<HTMLDivElement | null>(null);
    const shardsWrapRef = useRef<HTMLDivElement | null>(null);
    // Iris mode
    const irisRootRef = useRef<HTMLDivElement | null>(null);
    const irisDiscRef = useRef<HTMLDivElement | null>(null);
    const tlRef = useRef<gsap.core.Timeline | null>(null);
    const [mounted, setMounted] = useState(false);

    const tiles = useMemo(() => {
      const total = tileCols * tileRows;
      const colors = palette.length ? palette : defaultPalette;
      return makeArray(total).map((i) => ({ i, color: colors[i % colors.length] }));
    }, [tileCols, tileRows, palette]);

    useEffect(() => setMounted(true), []);

    React.useImperativeHandle(ref, () => ({
      play: ({ mode = "tiles", onMidway, onComplete, duration: d, variant }: { mode?: SnesSceneMode; onMidway?: () => void; onComplete?: () => void; duration?: number; variant?: "explode" | "implode" } = {}) => {
        const dur = d ?? duration;
        tlRef.current?.kill();

        if (!overlayRef.current) return;

        gsap.set(overlayRef.current, { autoAlpha: 1, pointerEvents: "auto" });
        gsap.set([
          tilesWrapRef.current,
          wipeRef.current,
          runesRootRef.current,
          irisRootRef.current,
        ], { display: "none" });

        const tl = gsap.timeline({
          paused: true,
          onComplete: () => {
            gsap.set(overlayRef.current!, { autoAlpha: 0, pointerEvents: "none" });
            onComplete?.();
          },
          defaults: { ease: easing },
        });

        if (mode === "tiles") {
          if (!tilesWrapRef.current) return;
          tl.add(
            buildTilesTimeline(tilesWrapRef.current, tileCols, tileRows, dur, easing, onMidway)
          );
        } else if (mode === "wipe") {
          if (!wipeRef.current || !wipeBarRef.current) return;
          tl.add(buildWipeTimeline(wipeRef.current, wipeBarRef.current, dur, easing, onMidway));
        } else if (mode === "runes") {
          if (!runesRootRef.current || !runesVeilRef.current || !runeSealRef.current || !flashRef.current || !shardsWrapRef.current) return;
          tl.add(
            buildRunesTimeline(
              runesRootRef.current,
              runesVeilRef.current,
              runeSealRef.current,
              flashRef.current,
              shardsWrapRef.current,
              dur,
              easing,
              variant ?? "explode",
              onMidway
            )
          );
        } else if (mode === "iris") {
          if (!irisRootRef.current || !irisDiscRef.current) return;
          tl.add(buildIrisTimeline(irisRootRef.current, irisDiscRef.current, dur, easing, onMidway));
        } else {
          if (debug) console.warn(`[SnesSceneTransition] Unknown mode "${mode}". Falling back to tiles.`);
          if (!tilesWrapRef.current) return;
          tl.add(buildTilesTimeline(tilesWrapRef.current, tileCols, tileRows, dur, easing, onMidway));
        }

        tl.play(0);
        tlRef.current = tl;
        return tl;
      },
    }));

    const paletteGradient = useMemo(() => {
      if (!palette?.length) return "#0b0f17";
      const stops = palette.join(", ");
      return `linear-gradient(90deg, ${stops})`;
    }, [palette]);

    return (
      <div
        ref={overlayRef}
        className={[
          "pointer-events-none fixed inset-0 z-[999] select-none",
          scanlines ? "[--scan:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)]" : "",
          className,
        ].join(" ")}
        style={{ opacity: 0 }}
      >
        {/* CRT vignette + scanlines */}
        <div className="absolute inset-0">
          {scanlines && (
            <div
              className="absolute inset-0 mix-blend-overlay opacity-60"
              style={{ backgroundImage: "var(--scan)", backgroundSize: "100% 2px" }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.6)]" />
        </div>

        {/* Tiles layer */}
        <div
          ref={tilesWrapRef}
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${tileCols}, 1fr)`,
            gridTemplateRows: `repeat(${tileRows}, 1fr)`,
            display: mounted ? undefined : "none",
          }}
        >
          {mounted &&
            tiles.map((t) => (
              <div key={t.i} style={{ backgroundColor: t.color }} />
            ))}
        </div>

        {/* Wipe layer */}
        <div ref={wipeRef} className="absolute inset-0 hidden">
          <div
            ref={wipeBarRef}
            className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[28vh] sm:h-[32vh] md:h-[38vh] lg:h-[42vh] xl:h-[48vh] shadow-[0_0_80px_rgba(0,0,0,0.35)]"
            style={{
              background: paletteGradient,
              filter: "saturate(120%)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          />
        </div>

        {/* Runes layer */}
        <div ref={runesRootRef} className="absolute inset-0 hidden items-center justify-center">
          {/* Veil to ensure full cover */}
          <div
            ref={runesVeilRef}
            className="absolute inset-0"
            style={{ background: "radial-gradient(60% 60% at 50% 50%, rgba(60,0,120,0.35), rgba(8,10,20,0.92))" }}
          />
          {/* Flash */}
          <div ref={flashRef} className="absolute inset-0 bg-white opacity-0" style={{ mixBlendMode: "screen" }} />

          {/* Centered rune seal */}
          <div ref={runeSealRef} className="relative w-[56vmin] h-[56vmin] pointer-events-none">
            <svg viewBox="0 0 100 100" className="absolute inset-0">
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g stroke="#bda6ff" fill="none" strokeWidth="0.6" filter="url(#glow)" opacity="0.9">
                <circle cx="50" cy="50" r="34" />
                <circle cx="50" cy="50" r="28" strokeOpacity="0.8" />
                <circle cx="50" cy="50" r="18" strokeOpacity="0.7" />
                {Array.from({ length: 6 }).map((_, i) => {
                  const angle = (i * Math.PI * 2) / 6;
                  const x1 = r4(50 + Math.cos(angle) * 18);
                  const y1 = r4(50 + Math.sin(angle) * 18);
                  const x2 = r4(50 + Math.cos(angle + Math.PI / 3) * 28);
                  const y2 = r4(50 + Math.sin(angle + Math.PI / 3) * 28);
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeOpacity="0.75" />;
                })}
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i * Math.PI * 2) / 12;
                  const x = r4(50 + Math.cos(a) * 34);
                  const y = r4(50 + Math.sin(a) * 34);
                  return <circle key={`r-${i}`} cx={x} cy={y} r="1.2" stroke="none" fill="#d8c8ff" />;
                })}
              </g>
            </svg>
          </div>

          {/* Shards */}
          <div ref={shardsWrapRef} className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 120 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 w-[3px] h-[3px]"
                style={{
                  transform: "translate(-50%, -50%)",
                  background: i % 3 === 0 ? "#bda6ff" : i % 3 === 1 ? "#7b00ff" : "#ffffff",
                  boxShadow: "0 0 8px rgba(189,166,255,0.8)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Iris layer */}
        <div ref={irisRootRef} className="absolute inset-0 hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(12,16,28,0.0),rgba(12,16,28,0.85))]" />
          <div
            ref={irisDiscRef}
            className="absolute left-1/2 top-1/2 w-[30vmax] h-[30vmax] rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(189,166,255,0.9) 25%, rgba(123,0,255,0.8) 55%, rgba(30,10,60,0.95) 100%)",
              boxShadow: "0 0 50px rgba(123,0,255,0.6), 0 0 120px rgba(189,166,255,0.4)",
            }}
          />
        </div>
      </div>
    );
  }
);

SnesSceneTransition.displayName = "SnesSceneTransition";

export default SnesSceneTransition;
