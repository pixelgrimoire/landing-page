// Utilidades para mapear precios de Stripe a "entitlements" (permisos/planes)
// Ahora 100% desde la base de datos (PlanConfig.entitlementsJson). Sin dependencias de ENV.
import { prisma } from '@/lib/prisma';

export type EntitlementGrant = {
  stripeCustomerId: string;
  entitlements: string[]; // p.ej. ["pos.basic", "sas.pro"]
  status: string; // p.ej. "active", "trialing", "past_due"
  currentPeriodEnd?: number; // epoch seconds
  customerEmail?: string | null; // si lo tenemos desde Stripe
};
// DB mapping: busca PlanConfig por price IDs y devuelve entitlementsJson.
export async function mapPriceIdsToEntitlementsDb(priceIds: string[]): Promise<string[]> {
  const set = new Set<string>();
  try {
    const rows = await prisma.planConfig.findMany({
      where: { OR: [ { priceMonthlyId: { in: priceIds } }, { priceYearlyId: { in: priceIds } } ] },
      select: { entitlementsJson: true },
    });
    for (const r of rows) {
      if (r?.entitlementsJson) {
        try {
          const arr = JSON.parse(r.entitlementsJson) as string[];
          for (const e of arr) if (e) set.add(e);
        } catch {}
      }
    }
  } catch {
    // Si falla la consulta, devuelve lista vacía.
    return [];
  }
  return Array.from(set);
}

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
