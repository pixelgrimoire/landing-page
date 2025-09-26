// Stripe Payment Element appearance tuned to PixelGrimoire style
// Docs: https://stripe.com/docs/elements/appearance-api
export const paymentAppearance = {
  variables: {
    colorPrimary: '#ffae00',
    colorBackground: 'rgba(8,6,16,0.92)',
    colorText: '#ffffff',
    colorDanger: '#ff7575',
    fontFamily: 'monospace',
    fontSizeBase: '14px',
    spacingUnit: '6px',
    borderRadius: '0px',
  },
  rules: {
    '.Input': {
      backgroundColor: 'rgba(0,0,0,0.35)',
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.2)',
      boxShadow: 'none',
    },
    '.Input:focus': {
      outline: '1px solid rgba(255,174,0,0.6)',
      boxShadow: '0 0 0 1px rgba(255,174,0,0.4)',
    },
    '.Label': { color: 'rgba(255,255,255,0.8)' },
    '.Tab, .Pill': { borderRadius: '0px' },
    '.Block': {
      backgroundColor: 'rgba(8,6,16,0.92)',
      borderRadius: '0px',
    },
    '.Error': { color: '#ff9b9b' },
    '.Link': { color: '#ffdf7a' },
    '.SubmitButton': {
      backgroundColor: '#ffae00',
      color: '#111',
      borderRadius: '0px',
      fontWeight: '700',
    },
    '.SubmitButton:hover': { backgroundColor: '#ffc54d' },
  },
} as const;
