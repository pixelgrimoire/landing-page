import type { Appearance } from '@clerk/types';

// Appearance config for Clerk widgets with a pixel/8‑bit + magic vibe
export const clerkAppearance: Appearance = {
  layout: {
    logoPlacement: 'inside',
    logoImageUrl: '/PixelGrimoireSimple.png',
    socialButtonsPlacement: 'bottom',
    helpPageUrl: 'mailto:sales@pixelgrimoire.com',
  },
  variables: {
    colorPrimary: '#ffae00',
    colorText: '#ffffff',
    colorBackground: 'rgba(8,6,16,0.92)',
    colorInputBackground: 'rgba(0,0,0,0.35)',
    colorInputText: '#ffffff',
    borderRadius: '0px',
    fontFamily: 'monospace',
    spacingUnit: '10px',
  },
  elements: {
    card: 'bg-[rgba(8,6,16,0.92)] border border-yellow-400/30 pixel-border shadow-[0_0_24px_rgba(255,174,0,.18)]',
    headerTitle: 'text-yellow-200 pixel-font',
    headerSubtitle: 'text-white/70 smooth-font',
    formButtonPrimary: 'bg-yellow-400 text-black hover:bg-yellow-300 pixel-border',
    formFieldInput: 'bg-black/30 border border-white/20 text-white pixel-border',
    formFieldLabel: 'text-white/80 smooth-font',
    footerActionText: 'text-white/70',
    footerActionLink: 'text-yellow-300 hover:text-yellow-200 underline',
    socialButtonsIconButton: 'pixel-border hover:bg-white/10',
    formFieldErrorText: 'text-red-300',
    identityPreviewText: 'text-white/90',
    dividerLine: 'bg-white/10',
    // UserButton popover tweaks (mejorar contraste en modo ghost/neutral)
    userButtonPopoverCard: 'bg-[rgba(8,6,16,0.98)] border border-white/10',
    userButtonPopoverActions: 'text-white',
    userButtonPopoverActionButton: 'text-white/85 hover:bg-white/10',
    userButtonPopoverActionButtonText: 'text-white',
    userButtonPopoverActionButtonIcon: 'text-white',
    userButtonPopoverFooter: 'text-white/70',
  },
};
