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

