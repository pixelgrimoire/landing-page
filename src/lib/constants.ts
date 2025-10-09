export const MAIL_TO = 'mailto:admin@pixelgrimoire.com';

export type Plan = {
  id: string;
  name: string;
  subtitle?: string;
  features: string[];
  priceM: number;
  priceY: number;
  popular?: boolean;
  comingSoon?: boolean;
  color: string;
};

export const PLANS: Plan[] = [
  {
    id: 'apprentice',
    name: 'Apprentice',
    features: [
      '1 app a elección (POS, WhatsApp IA, Taller o Retail)',
      'Actualizaciones automáticas',
      'Soporte básico por email',
    ],
    priceM: 15,
    priceY: 144, // Ahorra 20% pagando anual
    popular: true,
    color: '#ff00dd',
  },
  {
    id: 'mage',
    name: 'Mage',
    features: [
      'Acceso a 3 apps a elección',
      'Soporte prioritario (chat + email)',
      'Reportes básicos de rendimiento',
    ],
    priceM: 39,
    priceY: 374, // ~20% menos que mensual
    popular: false,
    comingSoon: true,
    color: '#00ffe1',
  },
  {
    id: 'archmage',
    name: 'Archmage',
    features: [
      'Acceso ilimitado a todas las apps',
      'Soporte 24/7 premium',
      'Reportes avanzados y analítica IA',
      'Integraciones personalizadas (API)',
    ],
    priceM: 79,
    priceY: 758,
    comingSoon: true, // demo por ahora
    color: '#ffae00',
  },
];

export type ProjectOption = { slug: string; label: string };
export const PROJECTS: ProjectOption[] = [
  { slug: 'qubito', label: 'Qubito' },
  { slug: 'nexia', label: 'Nexia' },
  { slug: 'nexora', label: 'Nexora' },
  { slug: 'soja', label: 'Soja' },
];
