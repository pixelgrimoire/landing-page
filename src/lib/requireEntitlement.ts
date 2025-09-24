import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function requireEntitlement(code: string) {
  const { userId } = await auth();
  if (!userId) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
  if (!user?.stripeCustomerId) {
    throw Object.assign(new Error('Forbidden: no subscription linked'), { status: 403 });
  }
  const entitlements = await prisma.entitlement.findMany({ where: { customerId: user.stripeCustomerId, status: { not: 'inactive' } } });
  const has = entitlements.some(e => e.code === code);
  if (!has) {
    throw Object.assign(new Error('Forbidden: missing entitlement'), { status: 403 });
  }
  return { userId, stripeCustomerId: user.stripeCustomerId, entitlements: entitlements.map(e=>e.code) };
}
