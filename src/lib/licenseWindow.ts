import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

export async function resolveLicenseValidUntil(params: {
  customerId: string;
  entitlementCurrentPeriodEnd?: Date | null;
}): Promise<Date | null> {
  if (params.entitlementCurrentPeriodEnd) return params.entitlementCurrentPeriodEnd;

  const sub = await prisma.subscription.findFirst({
    where: { customerId: params.customerId, status: { in: ['active', 'trialing', 'past_due'] } },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) return null;
  if (sub.currentPeriodEnd) return sub.currentPeriodEnd;

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return null;

  try {
    const stripe = new Stripe(sk);
    const liveSub = await stripe.subscriptions.retrieve(sub.stripeId);
    const currentPeriodEnd = (liveSub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
    const trialEnd = (liveSub as Stripe.Subscription & { trial_end?: number | null }).trial_end ?? null;

    const resolved = trialEnd
      ? new Date(trialEnd * 1000)
      : currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : null;

    if (resolved) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { currentPeriodEnd: resolved },
      }).catch(() => undefined);
    }

    return resolved;
  } catch {
    return null;
  }
}
