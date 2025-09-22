// Utilidades para mapear precios de Stripe a "entitlements" (permisos/planes)
// En lugar de depender de Product/Price metadata, usamos variables de entorno
// ya presentes para Checkout: STRIPE_PRICE_<PLAN>_M/Y y ENTITLEMENTS_<PLAN>
// Ej.: ENTITLEMENTS_APPRENTICE="pos.basic"; ENTITLEMENTS_MAGE="pos.pro,sas.basic"

export type EntitlementGrant = {
  stripeCustomerId: string;
  entitlements: string[]; // p.ej. ["pos.basic", "sas.pro"]
  status: string; // p.ej. "active", "trialing", "past_due"
  currentPeriodEnd?: number; // epoch seconds
};

function buildPriceToPlanIdMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    const m = key.match(/^STRIPE_PRICE_([A-Z0-9]+)_(M|Y)$/);
    if (m && value) {
      const planId = m[1];
      map[value] = planId; // priceId -> PLANID (UPPERCASE)
    }
  }
  return map;
}

function buildPlanIdToEntitlementsMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(process.env)) {
    const m = key.match(/^ENTITLEMENTS_([A-Z0-9]+)$/);
    if (m && value) {
      const planId = m[1];
      const ents = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      map[planId] = ents;
    }
  }
  return map;
}

const priceToPlanId = buildPriceToPlanIdMap();
const planIdToEntitlements = buildPlanIdToEntitlementsMap();

export function mapPriceIdsToEntitlements(priceIds: string[]): string[] {
  const set = new Set<string>();
  for (const pid of priceIds) {
    const planUpper = priceToPlanId[pid];
    if (!planUpper) continue;
    const ents = planIdToEntitlements[planUpper] || [];
    for (const e of ents) set.add(e);
  }
  return Array.from(set);
}

// Estas funciones son "stubs": aquí deberías integrar tu BD/servicio de usuarios.
export async function upsertUserEntitlements(grant: EntitlementGrant): Promise<void> {
  // TODO: reemplazar por persistencia real (Prisma/ORM/API interna)
  console.log("[entitlements] UPSERT", JSON.stringify(grant));
}

export async function revokeAllEntitlementsForCustomer(stripeCustomerId: string): Promise<void> {
  // TODO: reemplazar por persistencia real
  console.log("[entitlements] REVOKE ALL for", stripeCustomerId);
}

