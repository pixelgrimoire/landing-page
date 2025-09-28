import { prisma } from '@/lib/prisma';

export async function getCurrentPeriodEndForEntitlement(customerId: string, entitlementCode: string): Promise<Date | null> {
  const ent = await prisma.entitlement.findUnique({ where: { customerId_code: { customerId, code: entitlementCode } } });
  if (ent?.currentPeriodEnd) return ent.currentPeriodEnd;
  const sub = await prisma.subscription.findFirst({ where: { customerId, status: { in: ['active', 'trialing', 'past_due'] } }, orderBy: { currentPeriodEnd: 'desc' } });
  return sub?.currentPeriodEnd ?? null;
}
