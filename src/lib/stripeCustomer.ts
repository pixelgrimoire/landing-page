import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

type EnsureArgs = {
  userId: string;
  email?: string | null;
  name?: string | null;
  currentCustomerId?: string | null;
};

export async function ensureStripeCustomerForUser({ userId, email, name, currentCustomerId }: EnsureArgs): Promise<string | null> {
  if (currentCustomerId) {
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: currentCustomerId } }).catch(() => undefined);
    await prisma.customer.upsert({
      where: { id: currentCustomerId },
      update: { email: email ?? undefined, userId },
      create: { id: currentCustomerId, email: email ?? undefined, userId },
    });
    return currentCustomerId;
  }

  const stripe = getStripe();
  if (!stripe) return null;

  // Intenta encontrar por email primero (si está)
  let foundId: string | null = null;
  if (email) {
    const list = await stripe.customers.list({ email, limit: 1 });
    if (list.data[0]) {
      foundId = list.data[0].id;
    }
  }

  if (!foundId) {
    const created = await stripe.customers.create({ email: email || undefined, name: name || undefined, metadata: { userId } });
    foundId = created.id;
  }

  // Link en BD
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: foundId } });
  await prisma.customer.upsert({
    where: { id: foundId },
    update: { email: email ?? undefined, userId },
    create: { id: foundId, email: email ?? undefined, userId },
  });

  return foundId;
}

