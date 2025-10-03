export const MAIL_TO = 'mailto:admin@pixelgrimoire.com';

export type Plan = {
  id: string;
  name: string;
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
      'Acceso a un proyecto',
      'Publicación y hosting incluidos',
      'Tu enlace para compartir',
      'Soporte por WhatsApp y email',
    ],
    priceM: 9,
    priceY: 90,
    popular: true,
    color: '#ff00dd',
  },
  {
    id: 'mage',
    name: 'Mage',
    features: [
      'Más apps y plantillas',
      'Personalización de marca',
      'Formularios y analíticas simples',
      'Soporte prioritario',
    ],
    priceM: 29,
    priceY: 290,
    comingSoon: true,
    color: '#00ffe1',
  },
  {
    id: 'archmage',
    name: 'Archmage',
    features: [
      'Integraciones a medida',
      'Acompañamiento 1:1',
      'Marca blanca',
      'SLA básico',
    ],
    priceM: 99,
    priceY: 990,
    comingSoon: true,
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
