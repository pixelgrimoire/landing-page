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
      .pixel-font { font-family:'Press Start 2P', monospace; }
      .smooth-font { font-family:'Inter', ui-sans-serif, system-ui; }
      .pixelated { image-rendering: pixelated; }
      .pg-bg { background: radial-gradient(1200px 800px at 60% 10%, rgba(37,99,235,.25), transparent 60%),
                             radial-gradient(900px 600px at 40% 80%, rgba(107,33,168,.18), transparent 65%),
                             linear-gradient(180deg, var(--pg-ink), var(--pg-night)); }
      .glass { background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); backdrop-filter: blur(6px); }
      .pixel-border { position:relative; }
      .pixel-border:before { content:""; position:absolute; inset:-6px; pointer-events:none;
        background:
          linear-gradient(var(--pg-gold), var(--pg-gold)) top left / 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) top left / 2px 6px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) top right/ 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) top right/ 2px 6px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom left/ 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom left/ 2px 6px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom right/ 6px 2px no-repeat,
          linear-gradient(var(--pg-gold), var(--pg-gold)) bottom right/ 2px 6px no-repeat; filter: drop-shadow(0 0 6px rgba(250,204,21,.55)); }
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
      .magic-back { transform: rotateY(180deg); color:#fff; background: radial-gradient(60% 60% at 50% 50%, rgba(0,10,30,.8), rgba(0,10,40,.95)); border:1px solid rgba(255,255,255,.06); }
      .card-glow { position:absolute; inset:0; border-radius:inherit; pointer-events:none; opacity:0; transition:opacity .3s ease; background: radial-gradient( circle at var(--mouse-x) var(--mouse-y), var(--glow) 0%, transparent 60% ); filter: blur(18px); z-index:0; }
      .magic-card:hover .card-glow, .magic-card.active .card-glow { opacity:.85; }
      .edge-glow { position:absolute; inset:-6px; border-radius:26px; pointer-events:none; box-shadow:0 0 22px var(--glow); opacity:.45; transition:opacity .3s ease; }
      .magic-card:hover .edge-glow { opacity:.9; }
      .highlight { position:absolute; width:60%; height:60%; border-radius:50%; left:50%; top:50%; transform:translate(-50%,-50%); background: radial-gradient(circle at center, rgba(255,255,255,.5), rgba(255,255,255,.1) 40%, transparent 70%); opacity:0; filter: blur(10px); transition:opacity .3s ease, transform .3s ease; pointer-events:none; }
      .magic-card.active .highlight { opacity:.9; }
      .mag-circle { position:absolute; width:220px; height:220px; left:50%; top:50%; transform:translate(-50%,-50%); border-radius:50%; border:2px solid var(--glow); box-shadow:0 0 20px var(--glow), inset 0 0 16px var(--glow); opacity:.9; animation: spin 22s linear infinite; }
      @keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
      .rune { position:absolute; font-size:1.6rem; color: var(--glow); filter: drop-shadow(0 0 10px var(--glow)); opacity:0; transition: opacity .4s ease, transform .6s ease; pointer-events:none; }
      .magic-card.flipped .rune { opacity:1; }
      .rune-sprite { position:absolute; filter: drop-shadow(0 0 10px rgba(250,204,21,0.9)); opacity:0; will-change: transform, opacity, filter; }

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
    `}</style>
  );
}
