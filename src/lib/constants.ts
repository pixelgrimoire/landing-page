export const MAIL_TO = 'mailto:sales@pixelgrimoire.com';

export type Plan = {
  id: string;
  name: string;
  features: string[];
  priceM: number;
  priceY: number;
  popular?: boolean;
  color: string;
};

export const PLANS: Plan[] = [
  { id: 'apprentice', name: 'Apprentice', features: ['1 proyecto / mes','Soporte por email','Builds en Vercel'], priceM: 9, priceY: 90, color:'#ff00dd' },
  { id: 'mage', name: 'Mage', features: ['3 proyectos / mes','Componentes premium','Soporte prioritario'], priceM: 29, priceY: 290, popular:true, color:'#00ffe1' },
  { id: 'archmage', name: 'Archmage', features: ['Ilimitado','Integraciones a medida','Soporte 1:1'], priceM: 99, priceY: 990, color:'#ffae00' },
];

