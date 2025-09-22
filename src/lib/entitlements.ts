// Utilidades para mapear precios de Stripe a "entitlements" (permisos/planes)
// En lugar de depender de Product/Price metadata, usamos variables de entorno
// ya presentes para Checkout: STRIPE_PRICE_<PLAN>_M/Y y ENTITLEMENTS_<PLAN>
// Ej.: ENTITLEMENTS_APPRENTICE="pos.basic"; ENTITLEMENTS_MAGE="pos.pro,sas.basic"

export type EntitlementGrant = {
  stripeCustomerId: string;
  entitlements: string[]; // p.ej. ["pos.basic", "sas.pro"]
  status: string; // p.ej. "active", "trialing", "past_due"
  currentPeriodEnd?: number; // epoch seconds
  customerEmail?: string | null; // si lo tenemos desde Stripe
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

import { prisma } from '@/lib/prisma';

export async function upsertUserEntitlements(grant: EntitlementGrant): Promise<void> {
  const { stripeCustomerId, customerEmail, entitlements, status, currentPeriodEnd } = grant;

  // Asegurar Customer
  await prisma.customer.upsert({
    where: { id: stripeCustomerId },
    update: { email: customerEmail ?? undefined },
    create: { id: stripeCustomerId, email: customerEmail ?? undefined },
  });

  // Estado del periodo
  const cpeDate = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null;

  // Traer existentes para calcular diferencias
  const existing = await prisma.entitlement.findMany({ where: { customerId: stripeCustomerId } });
  const existingSet = new Set(existing.map((e) => e.code));
  const incomingSet = new Set(entitlements);

  // Upsert/Update entrantes
  for (const code of incomingSet) {
    await prisma.entitlement.upsert({
      where: { customerId_code: { customerId: stripeCustomerId, code } },
      update: { status, currentPeriodEnd: cpeDate ?? undefined },
      create: { customerId: stripeCustomerId, code, status, currentPeriodEnd: cpeDate ?? undefined },
    });
  }

  // Desactivar los que ya no aplican
  for (const code of existingSet) {
    if (!incomingSet.has(code)) {
      await prisma.entitlement.update({
        where: { customerId_code: { customerId: stripeCustomerId, code } },
        data: { status: 'inactive' },
      });
    }
  }
}

export async function revokeAllEntitlementsForCustomer(stripeCustomerId: string): Promise<void> {
  await prisma.entitlement.updateMany({
    where: { customerId: stripeCustomerId },
    data: { status: 'inactive' },
  });
}
