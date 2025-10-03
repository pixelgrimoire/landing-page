import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/constants';

export const runtime = 'nodejs';

function priceToPlanIdMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    const m = k.match(/^STRIPE_PRICE_([A-Z0-9]+)_(M|Y)$/);
    if (m && v) map[v] = m[1];
  }
  return map;
}

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
    if (!user?.stripeCustomerId) return new Response(JSON.stringify({ error: 'No Stripe customer linked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const customerId = user.stripeCustomerId;

    const sub = await prisma.subscription.findFirst({
      where: { customerId, status: { in: ['active', 'trialing', 'past_due'] } },
      orderBy: { createdAt: 'desc' },
    });

    // Entitlements and project selections
    const entitlements = await prisma.entitlement.findMany({ where: { customerId, status: { in: ['active', 'trialing', 'past_due'] } }, orderBy: { code: 'asc' } });
    // any-cast until model is generated in types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = prisma as any;
    const selections = await Promise.all(entitlements.map(async (e) => {
      const sel = await p.projectSelection.findUnique({ where: { customerId_entitlementCode: { customerId, entitlementCode: e.code } } }).catch(()=>null);
      return { entitlementCode: e.code, selection: sel || null };
    }));

    let planId: string | null = null;
    let planLabel: string | null = null;
    let interval: 'month' | 'year' | null = null;
    let subData: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: Date | null } | null = null;

    if (sub) {
      const item = await prisma.subscriptionItem.findFirst({ where: { subscriptionId: sub.id }, orderBy: { id: 'asc' } });
      const map = priceToPlanIdMap();
      const upper = item?.stripePriceId ? map[item.stripePriceId] : undefined;
      const planLower = upper ? upper.toLowerCase() : null;
      planId = planLower;
      planLabel = planLower ? (PLANS.find(p => p.id === planLower)?.name || planLower) : null;

      // Fetch price interval from Stripe for accuracy
      try {
        if (item?.stripePriceId) {
          const sk = process.env.STRIPE_SECRET_KEY;
          if (sk) {
            const stripe = new Stripe(sk);
            const price = await stripe.prices.retrieve(item.stripePriceId);
            interval = (price.recurring?.interval || null) as 'month' | 'year' | null;
          }
        }
      } catch {}
      subData = { status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, currentPeriodEnd: sub.currentPeriodEnd ?? null };
    } else {
      // Fallback: read directly from Stripe if DB isn't synced yet
      try {
        const sk = process.env.STRIPE_SECRET_KEY;
        if (sk) {
          const stripe = new Stripe(sk);
          const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
          const prefer = list.data.find(s => ['active','trialing','past_due'].includes(s.status)) || list.data[0];
          if (prefer) {
            const pi = prefer.items.data[0]?.price?.id || undefined;
            const map = priceToPlanIdMap();
            const upper = pi ? map[pi] : undefined;
            const planLower = upper ? upper.toLowerCase() : null;
            planId = planLower;
            planLabel = planLower ? (PLANS.find(p => p.id === planLower)?.name || planLower) : null;
            interval = (prefer.items.data[0]?.price?.recurring?.interval || null) as 'month'|'year'|null;
            const cpe = (prefer as Stripe.Subscription & { current_period_end?: number }).current_period_end;
            subData = {
              status: prefer.status,
              cancelAtPeriodEnd: !!prefer.cancel_at_period_end,
              currentPeriodEnd: cpe ? new Date(cpe * 1000) : null,
            };
          }
        }
      } catch {
        // ignore fallback errors; return whatever we have
      }
    }

    return new Response(JSON.stringify({
      subscription: subData ? {
        status: subData.status,
        cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
        currentPeriodEnd: subData.currentPeriodEnd?.toISOString() || null,
        planId,
        planLabel,
        interval,
      } : null,
      entitlements: entitlements.map(e => ({ code: e.code, currentPeriodEnd: e.currentPeriodEnd?.toISOString() || null, status: e.status })),
      selections,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
