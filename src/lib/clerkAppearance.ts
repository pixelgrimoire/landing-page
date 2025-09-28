import type { Appearance } from '@clerk/types';
import { dark } from '@clerk/themes';

// Appearance config for Clerk widgets with a pixel/8‑bit + magic vibe
export const clerkAppearance: Appearance = {
  layout: {
    logoPlacement: 'inside',
    logoImageUrl: '/PixelGrimoireSimple.png',
    socialButtonsPlacement: 'bottom',
    helpPageUrl: 'mailto:sales@pixelgrimoire.com',
  },
  theme: dark,
};
