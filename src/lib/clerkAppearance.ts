import type { Appearance } from '@clerk/types';
import { dark } from '@clerk/themes';

// Appearance config for Clerk widgets with a pixel/8‑bit + magic vibe
export const clerkAppearance: Appearance = {
  layout: {
    logoPlacement: 'inside',
    logoImageUrl: '/Logo Pixel Grimoire.svg',
    socialButtonsPlacement: 'bottom',
    helpPageUrl: 'mailto:sales@pixelgrimoire.com',
  },
  theme: dark,
  elements: {
    logoBox: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '6px',
    },
    logoImage: {
      width: '152px',
      height: '152px',
    },
  },
};
