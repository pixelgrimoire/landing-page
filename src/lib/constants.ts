export const MAIL_TO = 'mailto:admin@pixelgrimoire.com';

// Note: UI Plan types and data are now fetched from the database (PlanConfig)
// See src/lib/types.ts for the shared Plan UI type.

export type ProjectOption = { slug: string; label: string };
export const PROJECTS: ProjectOption[] = [
  { slug: 'qubito', label: 'Qubito' },
  { slug: 'nexia', label: 'Nexia' },
  { slug: 'nexora', label: 'Nexora' },
  { slug: 'soja', label: 'Soja' },
];
