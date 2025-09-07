import type { CSSProperties } from 'react';

export const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export type CSSGlowVars = CSSProperties & Record<'--glow', string>;
export type CSSDxVars = CSSProperties & Record<'--dx', string>;

