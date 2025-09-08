"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap, setupGSAP } from "@/lib/gsapSetup";

// Registrar GSAP + plugins una vez en el cliente
setupGSAP();

/** ------------------------------------------------------------
 *  Ritual Summon – Hook + Controlled Component
 *  - Tailwind + GSAP
 *  - Props / options:
 *      color      -> color principal (hex / css), ej. "#818cf8"
 *      durationMs -> tiempo de "casteo" antes de abrir modal (default 2800ms)
 *      intensity  -> 0.5 a 2.0 (volumen/partículas/efectos)
 *      sigilSize  -> px del círculo (default 520)
 *  -----------------------------------------------------------*/

export type RitualStage = "idle" | "casting" | "open";

export type RitualOptions = {
    color?: string;
    durationMs?: number; // tiempo de cántico antes de abrir
    intensity?: number;  // 0.5..2.0 (efectos/audio)
    sigilSize?: number;
};

export type RitualPortalProps = {
    /** Contenido del modal (cuando stage === "open") */
    children?: React.ReactNode;
    /** Título mostrado en el modal por defecto */
    title?: string;
    /** Mostrar ondas de choque al abrir */
    showShockwaves?: boolean;
    /** Fondo estrellado */
    showStarfield?: boolean;
    /** Llamado en “Esc” o botón Close del modal */
    onRequestClose?: () => void;
    /** Ancho del modal (ej. 64rem, 900px). Por defecto: 64rem */
    modalWidth?: number | string;
    /** Máximo ancho del modal (por defecto: calc(100vw - 2rem)) */
    modalMaxWidth?: number | string;
};

export type UseRitualSummonReturn = {
    open: boolean;
    stage: RitualStage;
    begin: () => void;
    dismiss: () => void;
    RitualPortal: React.FC<RitualPortalProps>;
};

/* ----------------------- Utils de color ----------------------- */
function hexToRgb(hex: string): [number, number, number] | null {
    const m = hex.replace("#", "").trim();
    const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
    if (!/^[0-9a-f]{6}$/i.test(full)) return null;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return [r, g, b];
}
function cssColorToRgbTriplet(color: string): [number, number, number] {
    const hex = hexToRgb(color);
    if (hex) return hex;
    // fallback: usar canvas para calcular
    if (typeof document !== "undefined") {
        const ctx = document.createElement("canvas").getContext("2d");
        if (ctx) {
            ctx.fillStyle = color;
            const computed = ctx.fillStyle as string; // suele normalizar a rgb(r,g,b)
            const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
        }
    }
    return [129, 140, 248]; // indigo-400 fallback
}

/* ----------------------- Hook principal ----------------------- */
export function useRitualSummon(options?: RitualOptions): UseRitualSummonReturn {
    const {
        color = "#818cf8",
        durationMs = 2800,
        intensity: rawIntensity = 1,
        sigilSize = 520,
    } = options || {};

    const intensity = Math.max(0.5, Math.min(2, rawIntensity));

    // Escala temporal: 1600ms es “baseline” original del ritual
    const BASE_MS = 1600;
    const timeScale = Math.max(0.35, durationMs / BASE_MS);
    const sec = useCallback((x: number) => x * timeScale, [timeScale]); // para GSAP/Audio (seg)
    const ms = useCallback((x: number) => Math.round(x * timeScale), [timeScale]); // para setTimeout (ms)

    const [stage, setStage] = useState<RitualStage>("idle");
    const open = stage !== "idle";

    // DOM refs
    const rootRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const starburstRef = useRef<HTMLDivElement | null>(null);
    const flashRef = useRef<HTMLDivElement | null>(null);
    const cometsRef = useRef<HTMLDivElement | null>(null);

    // Audio
    const audioRef = useRef<AudioContext | null>(null);
    const humGainRef = useRef<GainNode | null>(null);
    const humOscsRef = useRef<OscillatorNode[] | null>(null);

    const ensureAudio = useCallback(async () => {
        if (!audioRef.current) {
            const W = window as unknown as { webkitAudioContext?: typeof AudioContext; AudioContext: typeof AudioContext };
            const Ctor = W.AudioContext || W.webkitAudioContext;
            audioRef.current = new Ctor();
        }
        if (audioRef.current.state === "suspended") {
            try { await audioRef.current.resume(); } catch {}
        }
        return audioRef.current;
    }, []);

    const startHum = useCallback(async () => {
        const ctx = await ensureAudio();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = 62;
        const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = 124;
        o1.connect(gain); o2.connect(gain); gain.connect(ctx.destination);
        o1.start(); o2.start();
        const now = ctx.currentTime;
        gain.gain.linearRampToValueAtTime(0.025 * intensity, now + sec(0.5));
        humGainRef.current = gain; humOscsRef.current = [o1, o2];
    }, [ensureAudio, intensity, sec]);

    const stopHum = useCallback(async (delayMs = 0) => {
        const ctx = await ensureAudio();
        const g = humGainRef.current; const oscs = humOscsRef.current;
        if (!g || !oscs) return;
        const doStop = () => {
            const now = ctx.currentTime;
            g.gain.cancelScheduledValues(now);
            g.gain.linearRampToValueAtTime(0, now + sec(0.25));
            setTimeout(() => {
                oscs.forEach(o => { try { o.stop(); } catch {} });
                g.disconnect();
            }, ms(300));
            humGainRef.current = null; humOscsRef.current = null;
        };
        if (delayMs > 0) setTimeout(doStop, delayMs); else doStop();
    }, [ensureAudio, ms, sec]);

    const playWhoosh = useCallback(async () => {
        const ctx = await ensureAudio();
        const duration = sec(0.9);
        const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource(); src.buffer = buffer;
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 350;
        const gain = ctx.createGain(); gain.gain.value = 0.001;
        src.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
        const now = ctx.currentTime;
        bp.frequency.exponentialRampToValueAtTime(2200, now + duration);
        gain.gain.exponentialRampToValueAtTime(0.18 * intensity, now + sec(0.15));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        src.start();
    }, [ensureAudio, intensity, sec]);

    const playChime = useCallback(async () => {
        const ctx = await ensureAudio();
        const makeBell = (freq: number, t0 = ctx.currentTime) => {
            const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(ctx.destination);
            const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq; o.connect(g);
            o.start(t0);
            g.gain.exponentialRampToValueAtTime(0.2 * intensity, t0 + sec(0.02));
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + sec(0.9));
            o.stop(t0 + sec(1.0));
        };
        makeBell(784);
        makeBell(1175, ctx.currentTime + sec(0.05));
    }, [ensureAudio, intensity, sec]);

    // Esc para cerrar
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setStage("idle"); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const begin = useCallback(async () => {
        if (stage !== "idle") return;
        setStage("casting");
        await ensureAudio();
        startHum();
        playWhoosh();

        // Overlay fade-in
        if (overlayRef.current) {
            gsap.set(overlayRef.current, { opacity: 0 });
            gsap.to(overlayRef.current, { opacity: 1, duration: sec(0.6), ease: "power2.out" });
        }

        // Flash pulsos
        if (flashRef.current) {
            gsap.set(flashRef.current, { pointerEvents: "none" });
            gsap.fromTo(
                flashRef.current,
                { opacity: 0 },
                {
                    opacity: 0.5,
                    duration: sec(0.45),
                    ease: "sine.inOut",
                    repeat: 3,
                    yoyo: true,
                    onComplete: () => { if (flashRef.current) gsap.set(flashRef.current, { opacity: 0 }); },
                }
            );
        }

        // Starburst pop
        if (starburstRef.current) {
            gsap.fromTo(
                starburstRef.current,
                { opacity: 0, scale: 0.92 },
                { opacity: 0.85, scale: 1.04, duration: sec(0.9), ease: "power2.out", yoyo: true, repeat: 1 }
            );
        }

        // Runa-cometas
        if (cometsRef.current) {
            const container = cometsRef.current;
            container.innerHTML = "";
            const cw = container.clientWidth;
            const ch = container.clientHeight;
            const cx = cw / 2; const cy = ch / 2;
            const glyphs = ["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚺ","ᚾ","ᛁ","ᛃ","ᛇ","ᛈ","ᛉ","✦","✶"];
            const baseCount = 16;
            const count = Math.round(baseCount * intensity + 2);
            for (let i = 0; i < count; i++) {
                const el = document.createElement("div");
                el.className = "rune-comet absolute select-none";
                el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
                const r = (0.35 + Math.random() * 0.35) * Math.min(cw, ch);
                const ang = Math.random() * Math.PI * 2;
                const x0 = cx + Math.cos(ang) * r;
                const y0 = cy + Math.sin(ang) * r;
                Object.assign(el.style, {
                    left: `${x0}px`,
                    top: `${y0}px`,
                    transformOrigin: "50% 50%",
                    fontSize: `${12 + Math.random() * 10}px`,
                    fontWeight: "700",
                    color: "rgba(var(--accent-rgb), 0.95)",
                    textShadow: "0 0 6px rgba(var(--accent-rgb), 0.75)",
                    mixBlendMode: "screen",
                    willChange: "transform, opacity",
                    pointerEvents: "none",
                    fontFamily: '"Noto Sans Symbols", "Segoe UI Symbol", system-ui, sans-serif',
                } as CSSStyleDeclaration);
                container.appendChild(el);
                const dx = -Math.cos(ang) * (r - cw * 0.12);
                const dy = -Math.sin(ang) * (r - ch * 0.12);
                gsap.fromTo(
                    el,
                    { opacity: 0, scale: 0.85, rotate: 0 },
                    {
                        opacity: 1,
                        x: dx,
                        y: dy,
                        rotate: (Math.random() > 0.5 ? 1 : -1) * 90,
                        scale: 1.15,
                        duration: sec(1.6 + Math.random() * 0.8),
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: 1,
                        onComplete: () => el.remove(),
                    }
                );
            }
        }

        // Tras el delay de invocación, materializar modal
        window.setTimeout(() => {
            setStage("open");
            playChime();
            stopHum(500);
        }, durationMs);
    }, [durationMs, ensureAudio, intensity, sec, startHum, playWhoosh, playChime, stopHum, stage]);

    const dismiss = useCallback(() => {
        setStage("idle");
    }, []);

    // Shockwaves al abrir
    useEffect(() => {
        if (stage !== "open" || !rootRef.current) return;
        const ctx = gsap.context(() => {
            const waves = rootRef.current!.querySelectorAll(".shockwave");
            waves.forEach((w, i) => {
                gsap.fromTo(
                    w,
                    { opacity: 0.55, scale: 0.6 },
                    { opacity: 0, scale: 5 + i * 1.2 * intensity, duration: sec(1.4 + i * 0.25), ease: "power2.out" }
                );
            });
        }, rootRef);
        return () => ctx.revert();
    }, [stage, intensity, sec]);

    // Portal que usa el estado del hook
    const [r, g, b] = cssColorToRgbTriplet(color);
    const RitualPortal = useMemo<React.FC<RitualPortalProps>>(() => {
        return function Portal({
                                   children,
                                   title = "Arcane Manifestation",
                                   showShockwaves = true,
                                   showStarfield = true,
                                   onRequestClose,
                                   modalWidth,
                                   modalMaxWidth,
                               }) {
            const widthValue = typeof modalWidth === "number" ? `${modalWidth}px` : (modalWidth ?? "64rem");
            const maxWidthValue = typeof modalMaxWidth === "number" ? `${modalMaxWidth}px` : (modalMaxWidth ?? "calc(100vw - 2rem)");
            return (
                <div
                    ref={rootRef}
                    style={{ ["--accent-rgb"]: `${r}, ${g}, ${b}` } as unknown as React.CSSProperties}
                    className="fixed inset-0 z-50 text-zinc-100"
                    aria-hidden={!open}
                >
                    {/* Fondo */}
                    {showStarfield && <Starfield sec={sec} />}

                    {/* Overlay */}
                    {open && (
                        <div ref={overlayRef} className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />
                    )}

                    {/* Capa de ritual */}
                    {open && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* flash */}
                            <div
                                ref={flashRef}
                                className="absolute inset-0"
                                style={{
                                    mixBlendMode: "screen",
                                    background: "radial-gradient(circle at 50% 55%, rgba(224,231,255,0.30), rgba(var(--accent-rgb),0.18) 35%, rgba(0,0,0,0) 70%)",
                                    opacity: 0,
                                }}
                            />
                            {/* starburst */}
                            <div
                                ref={starburstRef}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                style={{ width: sigilSize - 40, height: sigilSize - 40 }}
                            >
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <span
                                        key={i}
                                        className="absolute left-1/2 top-1/2 origin-left h-px"
                                        style={{
                                            width: 220 + (i % 2 ? 60 : 0),
                                            transform: `rotate(${(360 / 16) * i}deg)`,
                                            backgroundColor: "rgba(var(--accent-rgb), 0.7)",
                                            boxShadow: "0 0 8px rgba(var(--accent-rgb), 0.65)",
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Círculo ritual */}
                            <RitualCircleGSAP
                                casting={stage === "casting"}
                                size={sigilSize}
                                sec={sec}
                                accentRGB={[r, g, b]}
                            />

                            {/* contenedor runas-cometa */}
                            <div
                                ref={cometsRef}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ width: sigilSize, height: sigilSize }}
                            />
                        </div>
                    )}

                    {/* Modal */}
                    {stage === "open" && (
                        <div role="dialog" aria-modal
                             className="absolute mx-4 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                             style={{ width: widthValue, maxWidth: maxWidthValue }}>
                            <div className="relative pointer-events-auto rounded-3xl overflow-hidden ring-1 ring-white/15 shadow-2xl">
                                <div className="absolute -inset-8 -z-10 opacity-90 mix-blend-screen">
                                    <div className="w-full h-full"
                                         style={{ background: "radial-gradient(circle at center, rgba(165,180,252,0.35), rgba(var(--accent-rgb),0.20) 35%, rgba(0,0,0,0) 70%)" }} />
                                </div>

                                <div className="bg-zinc-900/80 backdrop-blur-md p-6 sm:p-8">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-xl grid place-items-center ring-1"
                                             style={{ backgroundColor: "rgba(var(--accent-rgb), 0.18)", borderColor: "rgba(var(--accent-rgb),0.35)" }}>
                                            <SparkleIcon />
                                        </div>
                                        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h2>
                                    </div>

                                    {children ? (
                                        <div className="mt-4">{children}</div>
                                    ) : (
                                        <>
                                            <p className="mt-4 text-zinc-300 leading-relaxed">
                                                You have successfully completed the invocation. This modal materialized after a prolonged chant, runes and aether sparkles.
                                            </p>
                                            <ul className="mt-5 text-sm text-zinc-400 grid gap-2">
                                                <li>• GSAP-driven magic circle</li>
                                                <li>• Flashes, starburst rays, shockwaves, rune comets</li>
                                                <li>• Sound FX: whoosh + chime + subtle hum</li>
                                                <li>• Press Esc to close</li>
                                            </ul>
                                        </>
                                    )}

                                    <div className="mt-6 flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => { onRequestClose?.(); dismiss(); }}
                                            className="px-4 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 ring-1 ring-zinc-600/40">
                                            Close
                                        </button>
                                        <button
                                            onClick={() => { onRequestClose?.(); dismiss(); }}
                                            className="px-4 py-2 rounded-xl"
                                            style={{ backgroundColor: "rgba(var(--accent-rgb), 0.9)", boxShadow: "0 10px 20px -8px rgba(var(--accent-rgb),0.35)", border: "1px solid rgba(var(--accent-rgb),0.35)" }}>
                                            Continue
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {showShockwaves && (
                                <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <span
                                            key={i}
                                            className="shockwave absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                                            style={{
                                                width: 140, height: 140,
                                                borderColor: "rgba(var(--accent-rgb),0.7)",
                                                filter: "blur(1px)"
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Consejo */}
                    <div className="absolute bottom-3 left-0 right-0 z-0 text-center text-xs text-zinc-500">
                        Tip: Press <kbd className="px-1 py-0.5 rounded bg-zinc-800/80">Esc</kbd> to close the ritual.
                    </div>
                </div>
            );
        };
     }, [open, stage, dismiss, sigilSize, r, g, b, sec]);

    return { open, stage, begin, dismiss, RitualPortal };
}

/* -------------------- Componente Controlado -------------------- */
export type RitualSummonProps = RitualOptions & RitualPortalProps & {
    open: boolean;
    onOpenChange?: (next: boolean) => void;
};

export function RitualSummon(props: RitualSummonProps) {
    const { open, onOpenChange, durationMs, color, intensity, sigilSize, ...portal } = props;
    const ritual = useRitualSummon({ durationMs, color, intensity, sigilSize });

    // Sincronizar estado controlado
    const prevOpenRef = useRef<boolean>(ritual.open);
    useEffect(() => {
        const prev = prevOpenRef.current;
        if (!prev && open) {
            ritual.begin();
        } else if (prev && !open) {
            ritual.dismiss();
        }
        prevOpenRef.current = ritual.open;
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Propagar cambios al cerrar por Esc o botón
    const handleClose = useCallback(() => {
        onOpenChange?.(false);
    }, [onOpenChange]);

    return (
        ritual.open ? <ritual.RitualPortal {...portal} onRequestClose={handleClose} /> : null
    );
}

/* --------------------- Sub-componentes UI ---------------------- */
// Fondo estrellado
function Starfield({ sec }: { sec: (n: number) => number }) {
    const host = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!host.current) return;
        const ctx = gsap.context(() => {
            gsap.fromTo(host.current, { opacity: 0 }, { opacity: 0.6, duration: sec(1.2), ease: "sine.out" });
        });
        return () => ctx.revert();
    }, [sec]);

    return (
        <div ref={host} className="absolute inset-0 -z-10 overflow-hidden opacity-60">
            <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(30,27,75,0.6),rgba(9,9,11,0.9))]" />
            <div className="absolute inset-0 mix-blend-screen opacity-40 pointer-events-none"
                 style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "2px 2px" }} />
        </div>
    );
}

// Círculo ritual animado con GSAP (rotaciones estables)
function RitualCircleGSAP({
                              casting,
                              size,
                              sec,
                              accentRGB,
                          }: {
    casting: boolean;
    size: number;
    sec: (n: number) => number;
    accentRGB: [number, number, number];
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const ringsRef = useRef<SVGGElement | null>(null);
    const spokesRef = useRef<SVGGElement | null>(null);
    const textRef = useRef<SVGGElement | null>(null);

    // spark dots
    const sparks = useMemo(() => Array.from({ length: 80 }).map((_, i) => ({
        id: i,
        r: 110 + Math.random() * 140,
        a: Math.random() * Math.PI * 2,
        s: 2 + Math.random() * 3,
        o: 0.3 + Math.random() * 0.7,
    })), []);

    useEffect(() => {
        if (!containerRef.current) return;
        const ctx = gsap.context(() => {
            const els = [ringsRef.current, spokesRef.current, textRef.current].filter(Boolean) as Element[];
            gsap.killTweensOf(els);
            gsap.set(els, { clearProps: "transform" });

            if (casting) {
                gsap.to(ringsRef.current,  { rotation: 360,  duration: sec(12), ease: "none", repeat: -1, svgOrigin: "300 300" });
                gsap.to(spokesRef.current, { rotation: -360, duration: sec(18), ease: "none", repeat: -1, svgOrigin: "300 300" });
                gsap.to(textRef.current,   { rotation: 360,  duration: sec(24), ease: "none", repeat: -1, svgOrigin: "300 300" });
            }
        }, containerRef);
        return () => ctx.revert();
    }, [casting, sec]);

    useEffect(() => {
        if (!containerRef.current) return;
        const ctx = gsap.context(() => {
            const dots = containerRef.current!.querySelectorAll(".spark-dot");
            dots.forEach((el) => {
                gsap.fromTo(
                    el,
                    { opacity: 0, scale: 0.6, x: 0, y: 0 },
                    {
                        opacity: (el as HTMLElement).dataset.o ? parseFloat((el as HTMLElement).dataset.o!) : 0.8,
                        scale: 1,
                        x: `random(-7, 7)`,
                        y: `random(-7, 7)`,
                        duration: sec(1.6 + Math.random() * 1.2),
                        yoyo: true,
                        repeat: -1,
                        ease: "sine.inOut",
                    }
                );
            });
        }, containerRef);
        return () => ctx.revert();
    }, [sparks.length, sec]);

    const [r, g, b] = accentRGB;

    return (
        <div ref={containerRef} className="relative" style={{ width: size, height: size }}>
            {/* bloom aura */}
            <div className="absolute -inset-24 blur-3xl rounded-full"
                 style={{ background: `radial-gradient(circle at 50% 50%, rgba(165,180,252,0.35), rgba(${r},${g},${b},0.18) 35%, rgba(0,0,0,0) 70%)`,
                     mixBlendMode: "screen" }} />

            <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(224,231,255,0.85)" />
                        <stop offset="70%" stopColor={`rgba(${r},${g},${b},0.70)`} />
                        <stop offset="100%" stopColor={`rgba(${r},${g},${b},0.00)`} />
                    </radialGradient>
                    <path id="textPath" d={`M 300 300 m -240, 0 a 240,240 0 1,1 480,0 a 240,240 0 1,1 -480,0`} />
                </defs>

                <circle cx="300" cy="300" r="250" fill="url(#ringGrad)" opacity="0.35" />

                <g ref={ringsRef} filter="url(#glow)">
                    <circle cx="300" cy="300" r="210" fill="none" stroke="rgba(199,210,254,0.95)" strokeWidth="1.5" strokeDasharray="6 10" />
                    <circle cx="300" cy="300" r="180" fill="none" stroke="rgba(199,210,254,0.95)" strokeWidth="1.5" strokeDasharray="2 8" />
                    <circle cx="300" cy="300" r="150" fill="none" stroke="rgba(199,210,254,0.95)" strokeWidth="1.3" strokeDasharray="1 5" />
                </g>

                <g ref={spokesRef} filter="url(#glow)">
                    {Array.from({ length: 6 }).map((_, i) => {
                        const angle = (i * Math.PI * 2) / 6;
                        const x1 = 300 + Math.cos(angle) * 40;
                        const y1 = 300 + Math.sin(angle) * 40;
                        const x2 = 300 + Math.cos(angle) * 220;
                        const y2 = 300 + Math.sin(angle) * 220;
                        return (
                            <g key={i}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(199,210,254,0.95)" strokeWidth="1.2" opacity="0.9" />
                                <circle cx={x2} cy={y2} r="6" fill="none" stroke="rgba(199,210,254,0.95)" strokeWidth="1.2" />
                            </g>
                        );
                    })}
                </g>

                <g ref={textRef}>
                    <text fill="rgba(224,231,255,0.9)" fontSize="14" letterSpacing="8">
                        <textPath xlinkHref="#textPath" startOffset="0%">
                            ✶ VOCEM ✦ SIGILLUM ✦ APERIRE ✦ LUMEN ✦ ARCANA ✦ ᚠᚢᚦᚨᚱᚲᚷᚺᚾᛁᛃᛇᛈᛉ ✶
                        </textPath>
                    </text>
                </g>

                <circle cx="300" cy="300" r="24" fill={`rgba(${r},${g},${b},0.9)`} />
                <circle cx="300" cy="300" r="56" fill="none" stroke="rgba(199,210,254,0.95)" strokeWidth="1.4" />
                <circle cx="300" cy="300" r="92" fill="none" stroke="rgba(199,210,254,0.95)" strokeWidth="1.2" opacity="0.8" />
            </svg>

            {/* spark dots */}
            {sparks.map((p) => {
                const x = size / 2 + Math.cos(p.a) * p.r;
                const y = size / 2 + Math.sin(p.a) * p.r;
                return (
                    <span key={p.id} className="spark-dot absolute rounded-full shadow-[0_0_8px_rgba(0,0,0,0.0)]"
                          data-o={p.o}
                          style={{
                              left: x,
                              top: y,
                              width: p.s,
                              height: p.s,
                              backgroundColor: `rgba(${r},${g},${b},0.90)`,
                              boxShadow: `0 0 8px rgba(${r},${g},${b},0.70)`
                          }} />
                );
            })}

            {/* texto decorativo */}
            <div className="absolute inset-0 grid place-items-center text-center select-none">
                <div className="text-[10px] sm:text-xs tracking-[0.35em] text-indigo-200/70">
                    ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ · VOCEM · SIGILLUM · APERIRE · LUMEN · ARCANA ·
                </div>
            </div>
        </div>
    );
}

function SparkleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3z" fill="currentColor" />
        </svg>
    );
}
