export const PRODUCT_APPS = ['qubito', 'nexia', 'nexora', 'soja'] as const;
export const PLAN_LEVELS = ['apprentice', 'mage', 'archmage'] as const;

type ProductApp = (typeof PRODUCT_APPS)[number];
type PlanLevel = (typeof PLAN_LEVELS)[number];

const PRODUCT_APP_SET = new Set<string>(PRODUCT_APPS);
const PLAN_LEVEL_SET = new Set<string>(PLAN_LEVELS);

const LEGACY_QUBITO_LEVELS: Record<string, PlanLevel> = {
  'pos.basic': 'apprentice',
  'pos.pro': 'mage',
  'pos.enterprise': 'archmage',
};

const LEGACY_NEXORA_LEVELS: Record<string, PlanLevel> = {
  'nexora.basic': 'apprentice',
  'nexora.pro': 'mage',
  'nexora.enterprise': 'archmage',
};

export function getEntitlementAppSlug(code: string | null | undefined): ProductApp | null {
  const normalized = (code || '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized in LEGACY_QUBITO_LEVELS) return 'qubito';
  if (normalized in LEGACY_NEXORA_LEVELS) return 'nexora';

  const [appSlug] = normalized.split('.');
  if (PRODUCT_APP_SET.has(appSlug)) return appSlug as ProductApp;
  return null;
}

export function getEntitlementPlanLevel(code: string | null | undefined): PlanLevel | null {
  const normalized = (code || '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized in LEGACY_QUBITO_LEVELS) return LEGACY_QUBITO_LEVELS[normalized];
  if (normalized in LEGACY_NEXORA_LEVELS) return LEGACY_NEXORA_LEVELS[normalized];

  const [, planLevel] = normalized.split('.');
  if (PLAN_LEVEL_SET.has(planLevel)) return planLevel as PlanLevel;
  return null;
}

export function isAppSpecificEntitlement(code: string | null | undefined): boolean {
  return Boolean(getEntitlementAppSlug(code) && getEntitlementPlanLevel(code));
}

export function isLegacyProjectSelectionEntitlement(code: string | null | undefined): boolean {
  const normalized = (code || '').trim().toLowerCase();
  return normalized in LEGACY_QUBITO_LEVELS;
}

export function matchesAppEntitlement(code: string | null | undefined, appSlug: string | null | undefined): boolean {
  const normalizedApp = (appSlug || '').trim().toLowerCase();
  if (!normalizedApp) return false;
  return getEntitlementAppSlug(code) === normalizedApp;
}

export function buildEntitlementCode(appSlug: string, planLevel: string): string {
  return `${appSlug.trim().toLowerCase()}.${planLevel.trim().toLowerCase()}`;
}

export function normalizeEntitlementCodeForApp(
  code: string | null | undefined,
  preferredAppSlug?: string | null
): string {
  const normalized = (code || '').trim().toLowerCase();
  if (!normalized) return normalized;

  const appSlug = (preferredAppSlug || getEntitlementAppSlug(normalized) || '').trim().toLowerCase();
  const planLevel = getEntitlementPlanLevel(normalized);
  if (!appSlug || !planLevel) return normalized;
  return buildEntitlementCode(appSlug, planLevel);
}
