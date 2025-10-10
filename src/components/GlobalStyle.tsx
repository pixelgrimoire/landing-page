'use client';

import { useEffect } from 'react';

export default function GlobalStyle() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Press+Start+2P&display=swap';
    document.head.appendChild(link);
    return () => { if (link.parentNode) link.parentNode.removeChild(link); };
  }, []);

  return (
    <style>{`
      :root { --pg-ink:#0f0f1a; --pg-night:#0a0a14; --pg-violet:#6B21A8; --pg-blue:#2563EB; --pg-gold:#FACC15; }
      /* Use dark-native form controls (affects select dropdown painting on Chromium/Edge) */
      html { color-scheme: dark; }
      /* Base dark styling for form controls */
      select, input, textarea { background-color: rgba(255,255,255,.06); color:#e5e7eb; border:1px solid rgba(255,255,255,.12); }
      select:focus, input:focus, textarea:focus { outline:none; box-shadow: 0 0 0 2px rgba(250,204,21,.35); }
      /* Ensure dropdown options are readable on dark backgrounds */
      select option { background-color: #0b1220; color: #e5e7eb; }
      .pixel-font { font-family:'Press Start 2P', monospace; }
      .smooth-font { font-family:'Inter', ui-sans-serif, system-ui; }
      .pixelated { image-rendering: pixelated; }
      .pg-bg { background: radial-gradient(1200px 800px at 60% 10%, rgba(37,99,235,.25), transparent 60%),
                             radial-gradient(900px 600px at 40% 80%, rgba(107,33,168,.18), transparent 65%),
                             linear-gradient(180deg, var(--pg-ink), var(--pg-night)); transition: background .45s ease; }
      .pg-bg[data-magic='off'] { background: linear-gradient(180deg, #0b0f17, #0b0f17); }
      .glass { background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); backdrop-filter: blur(6px); }
      .pixel-border { position:relative; }
      .pixel-border:before { content:""; position:absolute; inset:-6px; pointer-events:none; transition: opacity .45s ease;
        background:
          linear-gradient(var(--pg-gold), var(--pg-gold)) top left / 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) top left / 2px 6px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) top right/ 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) top right/ 2px 6px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom left/ 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom left/ 2px 6px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom right/ 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom right/ 2px 6px no-repeat; filter: drop-shadow(0 0 6px rgba(250,204,21,.55)); }
      [data-magic='off'] .pixel-border:before { opacity: 0; }
      .btn { position:relative; }
      .btn:after { content:""; position:absolute; inset:2px -4px -4px 2px; background: rgba(0,0,0,.25); clip-path: polygon(0 0, 100% 0, 100% 100%, 6px 100%, 6px 6px, 0 6px); }
      .runes { text-shadow: 0 0 8px rgba(250,204,21,.8), 0 0 20px rgba(37,99,235,.5); }
      .fade-up { opacity:0; transform: translateY(12px); animation: fadeUp .7s ease-out forwards; }
      @keyframes fadeUp { to { opacity:1; transform: translateY(0); } }
      .rune-anim { animation-name: runeRise; animation-timing-function: cubic-bezier(.22,1,.36,1); animation-fill-mode: forwards; }
      @keyframes runeRise {
        0% { opacity:0; transform: translate(0,0); filter: drop-shadow(0 0 10px rgba(250,204,21,0.9)) blur(0px); }
        15% { opacity:.95; filter: drop-shadow(0 0 10px rgba(250,204,21,0.9)) blur(0px); }
        75% { opacity:.9; transform: translate(var(--dx,0px), -260px); filter: drop-shadow(0 0 10px rgba(250,204,21,0.9)) blur(0px); }
        100% { opacity:0; transform: translate(var(--dx,0px), -260px); filter: drop-shadow(0 0 10px rgba(250,204,21,0.9)) blur(10px); }
      }
      
      /* Magic subscription cards */
      .magic-card { position:relative; height: 420px; border-radius: 22px; --glow:#7b00ff; --mouse-x:50%; --mouse-y:50%; }
      .magic-inner { position:absolute; inset:0; border-radius:inherit; transform-style:preserve-3d; transition: transform .8s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      .magic-card.flipped .magic-inner { transform: rotateY(180deg); }
      .magic-pane { position:absolute; inset:0; border-radius:inherit; backface-visibility:hidden; overflow:hidden; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:1.25rem; }
      .magic-front { background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.1); }
      /* Optional darker skin to match the annual/back face */
      .magic-skin { color:#fff; background: radial-gradient(60% 60% at 50% 50%, rgba(0,10,30,.8), rgba(0,10,40,.95)) !important; border:1px solid rgba(255,255,255,.06) !important; }
      .magic-back { transform: rotateY(180deg); color:#fff; background: radial-gradient(60% 60% at 50% 50%, rgba(0,10,30,.8), rgba(0,10,40,.95)); border:1px solid rgba(255,255,255,.06); }
      .card-glow { position:absolute; inset:0; border-radius:inherit; pointer-events:none; opacity:0; transition:opacity .3s ease; background: radial-gradient( circle at var(--mouse-x) var(--mouse-y), var(--glow) 0%, transparent 60% ); filter: blur(18px); z-index:0; }
      .magic-card:hover .card-glow, .magic-card.active .card-glow { opacity:.85; }
      .edge-glow { position:absolute; inset:-6px; border-radius:26px; pointer-events:none; box-shadow:0 0 22px var(--glow); opacity:.45; transition:opacity .3s ease; }
      .magic-card:hover .edge-glow { opacity:.9; }
      [data-magic='off'] .edge-glow { opacity: 0 !important; }
      .highlight { position:absolute; width:60%; height:60%; border-radius:50%; left:50%; top:50%; transform:translate(-50%,-50%); background: radial-gradient(circle at center, rgba(255,255,255,.5), rgba(255,255,255,.1) 40%, transparent 70%); opacity:0; filter: blur(10px); transition:opacity .3s ease, transform .3s ease; pointer-events:none; }
      .magic-card.active .highlight { opacity:.9; }
      [data-magic='off'] .highlight { opacity: 0; }
      .mag-circle { position:absolute; width:220px; height:220px; left:50%; top:50%; transform:translate(-50%,-50%); border-radius:50%; border:2px solid var(--glow); box-shadow:0 0 20px var(--glow), inset 0 0 16px var(--glow); opacity:.9; animation: spin 22s linear infinite; }
      @keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
      .rune { position:absolute; font-size:1.6rem; color: var(--glow); filter: drop-shadow(0 0 10px var(--glow)); opacity:.5; transition: opacity .4s ease, transform .6s ease; pointer-events:none; }
      .magic-card.flipped .rune { opacity:1; }
      .rune-sprite { position:absolute; filter: drop-shadow(0 0 10px rgba(250,204,21,0.9)); opacity:0; will-change: transform, opacity, filter; }
      .rune-layer { transform: translate(var(--parallax-x, 0px), var(--parallax-y, 0px)); transition: transform .12s ease-out; will-change: transform; z-index: 0; }
      .rune-mini-wrap { position:absolute; transform: translate(-50%,-50%); animation: miniFloat var(--fdur, 8s) ease-in-out var(--fdel, 0s) infinite; }
      .rune-mini { display:inline-block; font-size: .9rem; opacity: .65; color: var(--glow); filter: drop-shadow(0 0 6px var(--glow)); animation: miniPulse 5.5s ease-in-out var(--tdel, 0s) infinite; }
      @keyframes miniFloat {
        0% { transform: translate(-50%, -50%); }
        50% { transform: translate(calc(-50% + var(--dx, 6px)), calc(-50% + var(--dy, -4px))); }
        100% { transform: translate(-50%, -50%); }
      }
      @keyframes miniPulse { 0%,100% { opacity: .55; filter: drop-shadow(0 0 5px var(--glow)); } 50% { opacity: .9; filter: drop-shadow(0 0 10px var(--glow)); } }

      /* Hero overrides for serious mode */
      .hero-title { transition: all .35s ease; }
      [data-magic='off'] .hero-title { color:#fff; background:none !important; -webkit-text-fill-color:#fff; text-shadow:none; }
      [data-magic='off'] .hero-primary { background: rgba(255,255,255,.12) !important; color:#fff !important; border:1px solid rgba(255,255,255,.18); }
      [data-magic='off'] .hero-primary:hover { background: rgba(255,255,255,.18) !important; filter:none; }
      [data-magic='off'] .hero-secondary { background: transparent !important; border-color: rgba(255,255,255,.22) !important; }

      /* Pixel-style close button (retro octagon coin) */
      .pixel-close-btn { position:absolute; width:42px; height:42px; display:grid; place-items:center; cursor:pointer; }
      .pixel-close-btn .btn-face { position:relative; width:34px; height:34px; clip-path: polygon(22% 0, 78% 0, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0 78%, 0 22%);
        background: linear-gradient(180deg, #f59e0b, #fbbf24); box-shadow: inset -3px -3px 0 #d97706, inset 2px 2px 0 #fde68a, 0 0 0 2px #fcd34d, 0 0 14px rgba(250,204,21,.55); image-rendering: pixelated; border-radius:6px; }
      .pixel-close-btn .btn-face:before { content:'✕'; position:absolute; inset:0; display:grid; place-items:center; color:#3b1a03; font-family:'Press Start 2P', monospace; font-size:12px; line-height:1; text-shadow: 0 1px 0 #fde68a, 0 0 6px rgba(0,0,0,.35); }
      .pixel-close-btn:hover .btn-face { filter: brightness(1.05); box-shadow: inset -3px -3px 0 #d97706, inset 2px 2px 0 #fff3b0, 0 0 0 2px #fcd34d, 0 0 18px rgba(250,204,21,.75); }
      .pixel-close-btn:active .btn-face { transform: translateY(1px); box-shadow: inset -1px -1px 0 #b45309, inset 1px 1px 0 #fde68a, 0 0 0 2px #facc15, 0 0 10px rgba(250,204,21,.5); }

      /* Magic/pixel scrollbars (global and .magic-scroll containers) */
      html, body, .magic-scroll { scrollbar-width: thin; scrollbar-color: var(--pg-gold) rgba(255,255,255,.08); }
      /* WebKit */
      ::-webkit-scrollbar { width: 12px; height: 12px; }
      .magic-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); border-radius: 10px; }
      .magic-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,.05); }
      ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #facc15, #f59e0b); border-radius: 10px; border: 2px solid rgba(0,0,0,.35); box-shadow: 0 0 10px rgba(250,204,21,.35), inset 0 0 6px rgba(0,0,0,.25); }
      ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #fbbf24, #f59e0b); box-shadow: 0 0 14px rgba(250,204,21,.6), inset 0 0 8px rgba(0,0,0,.25); }
      ::-webkit-scrollbar-corner { background: transparent; }
      /* Pixel edge accents on thumbs */
      ::-webkit-scrollbar-thumb:before { content:""; display:block; height:100%; width:100%; }

      /* Stabilize layout when scrollbars appear */
      html { scrollbar-gutter: stable both-edges; }

      /* Hide rune layers and extra sparkles when magic is off */
      [data-magic='off'] .runes, [data-magic='off'] .rune, [data-magic='off'] .rune-sprite { display: none !important; }
      [data-magic='off'] .pixel-font { font-family:'Inter', ui-sans-serif, system-ui; letter-spacing: 0; text-transform: none; }
      [data-magic='off'] .pixelated { image-rendering: auto; }
      [data-magic='off'] .glass { background: rgba(255,255,255,.04); backdrop-filter: none; border-color: rgba(255,255,255,.12); }
      [data-magic='off'] .btn:after { display: none; }
      [data-magic='off'] .magic-card .magic-inner { transform: none !important; }
      [data-magic='off'] .magic-card { box-shadow: none; }
      [data-magic='off'] .pixel-close-btn { width:36px; height:36px; }
      [data-magic='off'] .pixel-close-btn .btn-face { clip-path: none; background: rgba(255,255,255,.1); border-radius: 9999px; box-shadow: none; }
      [data-magic='off'] .pixel-close-btn .btn-face:before { font-family:'Inter', ui-sans-serif, system-ui; font-size:14px; color:#fff; text-shadow:none; }
      [data-magic='off'] .pixel-close-btn:hover .btn-face { filter:none; background: rgba(255,255,255,.18); }
      [data-magic='off'] .pixel-close-btn:active .btn-face { transform:none; }
    
      /* Gentle floating animation for hero visual (image + magic circle) */
      .float-slow { animation: floatY 6.5s ease-in-out infinite; will-change: transform; }
      .float-slower { animation: floatY 9s ease-in-out infinite; will-change: transform; }
      @keyframes floatY {
        0% { transform: translateY(0); }
        50% { transform: translateY(-16px); }
        100% { transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .float-slow, .float-slower { animation: none !important; }
      }
      /* Magic toggle attention effects (active even when magic is OFF) */
      .magic-toggle { position: relative; overflow: visible; }
      .magic-toggle.is-off {
        /* soft golden breathing glow */
        animation: glowPulse 2.6s ease-in-out infinite;
        box-shadow: 0 0 0 0 rgba(250,204,21,0.0), 0 0 0 0 rgba(123,0,255,0.0);
      }
      @keyframes glowPulse {
        0% { filter: drop-shadow(0 0 0px rgba(250,204,21,0.0)); }
        35% { filter: drop-shadow(0 0 10px rgba(250,204,21,0.55)) drop-shadow(0 0 18px rgba(123,0,255,0.25)); }
        70% { filter: drop-shadow(0 0 8px rgba(250,204,21,0.35)) drop-shadow(0 0 14px rgba(37,99,235,0.25)); }
        100% { filter: drop-shadow(0 0 0px rgba(250,204,21,0.0)); }
      }
      .magic-toggle.tease { animation: nudge 1.1s cubic-bezier(.22,1,.36,1) 1; }
      @keyframes nudge {
        0% { transform: translate(0,0) rotate(0deg); }
        10% { transform: translate(1px,-1px) rotate(-0.5deg); }
        25% { transform: translate(-2px,2px) rotate(0.6deg); }
        40% { transform: translate(2px,-2px) rotate(-0.8deg); }
        60% { transform: translate(-1px,1px) rotate(0.5deg); }
        80% { transform: translate(1px,0) rotate(-0.3deg); }
        100% { transform: translate(0,0) rotate(0deg); }
      }
      .magic-spark {
        position: absolute; width: 3px; height: 3px; border-radius: 0;
        background: var(--c, #FACC15); opacity: 0; pointer-events: none;
        box-shadow: 0 0 8px rgba(250,204,21,.7);
        animation: sparkleUp var(--dur, 900ms) ease-out forwards;
      }
      @keyframes sparkleUp {
        0% { opacity: 0; transform: translate(0, 0) scale(1); filter: blur(0); }
        10% { opacity: .95; }
        60% { opacity: .9; transform: translate(var(--dx, 0px), calc(-1 * var(--h, 26px))) scale(1); }
        100% { opacity: 0; transform: translate(calc(var(--dx, 0px) * 1.2), calc(-1 * var(--h, 26px) - 10px)) scale(.9); filter: blur(1px); }
      }

      /* Clerk logo swap: when magic is OFF, show SVG bg and hide the img */
      [data-magic='off'] .cl-logoBox { background-image: url('/Logo Pixel Grimoire Simple.svg'); background-size: contain; background-repeat: no-repeat; background-position: center; }
      [data-magic='off'] .cl-logoBox .cl-logoImage { opacity: 0 !important; width: 0 !important; height: 0 !important; }
    `}</style>
  );
}
