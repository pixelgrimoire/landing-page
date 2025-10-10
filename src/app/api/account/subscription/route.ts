import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { mapPriceIdsToEntitlementsDb, upsertUserEntitlements } from '@/lib/entitlements';

export const runtime = 'nodejs';

async function dbPriceToPlanIdMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const rows = await prisma.planConfig.findMany({ select: { planId: true, priceMonthlyId: true, priceYearlyId: true } });
  for (const r of rows) {
    if (r.priceMonthlyId) map[r.priceMonthlyId] = r.planId.toUpperCase();
    if (r.priceYearlyId) map[r.priceYearlyId] = r.planId.toUpperCase();
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
    let entitlements = await prisma.entitlement.findMany({ where: { customerId, status: { in: ['active', 'trialing', 'past_due'] } }, orderBy: { code: 'asc' } });
    // any-cast until model is generated in types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = prisma as any;
    const selections = await Promise.all(entitlements.map(async (e) => {
      const sel = await p.projectSelection.findUnique({ where: { customerId_entitlementCode: { customerId, entitlementCode: e.code } } }).catch(()=>null);
      return { entitlementCode: e.code, selection: sel || null };
    }));

    let planId: string | null = null;
    let planLabel: string | null = null;
    let planGraceDays: number | null = null;
    let planTrialDays: number | null = null;
    let interval: 'month' | 'year' | null = null;
    let subData: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: Date | null } | null = null;

    let priceIdsForEnt: string[] = [];
    if (sub) {
      const item = await prisma.subscriptionItem.findFirst({ where: { subscriptionId: sub.id }, orderBy: { id: 'asc' } });
      const allItems = await prisma.subscriptionItem.findMany({ where: { subscriptionId: sub.id } });
      priceIdsForEnt = allItems.map(i => i.stripePriceId).filter(Boolean);
      const map = await dbPriceToPlanIdMap();
      const upper = item?.stripePriceId ? map[item.stripePriceId] : undefined;
      const planLower = upper ? upper.toLowerCase() : null;
      planId = planLower;
      if (planLower) {
        const cfg = await prisma.planConfig.findUnique({ where: { planId: planLower } });
        planLabel = cfg?.name || planLower;
        planGraceDays = typeof cfg?.graceDays === 'number' ? cfg?.graceDays : null;
        planTrialDays = typeof cfg?.trialDays === 'number' ? cfg?.trialDays : null;
      } else {
        planLabel = null;
      }

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
            const map = await dbPriceToPlanIdMap();
            const upper = pi ? map[pi] : undefined;
            const planLower = upper ? upper.toLowerCase() : null;
            planId = planLower;
            if (planLower) {
              const cfg = await prisma.planConfig.findUnique({ where: { planId: planLower } });
              planLabel = cfg?.name || planLower;
              planGraceDays = typeof cfg?.graceDays === 'number' ? cfg?.graceDays : null;
              planTrialDays = typeof cfg?.trialDays === 'number' ? cfg?.trialDays : null;
            } else {
              planLabel = null;
            }
            priceIdsForEnt = prefer.items.data.map(i => (typeof i.price?.id === 'string' ? i.price.id : null)).filter(Boolean) as string[];
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

    // Fallback mapping if webhook didn't grant entitlements yet (useful in local dev)
    if (entitlements.length === 0 && priceIdsForEnt.length > 0 && subData?.status) {
      try {
        const inferred = await mapPriceIdsToEntitlementsDb(priceIdsForEnt);
        if (inferred.length) {
          await upsertUserEntitlements({
            stripeCustomerId: customerId,
            entitlements: inferred,
            status: subData.status,
            currentPeriodEnd: subData.currentPeriodEnd ? Math.floor(+subData.currentPeriodEnd / 1000) : undefined,
          });
          entitlements = await prisma.entitlement.findMany({ where: { customerId, status: { in: ['active', 'trialing', 'past_due'] } }, orderBy: { code: 'asc' } });
        }
      } catch {}
    }

    // Derived helpers
    const now = new Date();
    const trialRemainingDays = (subData?.status === 'trialing' && subData.currentPeriodEnd)
      ? Math.max(0, Math.ceil((+subData.currentPeriodEnd - +now) / (1000*60*60*24)))
      : null;
    const graceRemainingDays = (subData?.status === 'past_due' && subData.currentPeriodEnd && typeof planGraceDays === 'number')
      ? Math.max(0, Math.ceil(((+subData.currentPeriodEnd + (planGraceDays*24*60*60*1000)) - +now) / (1000*60*60*24)))
      : null;

    return new Response(JSON.stringify({
      subscription: subData ? {
        status: subData.status,
        cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
        currentPeriodEnd: subData.currentPeriodEnd?.toISOString() || null,
        planId,
        planLabel,
        interval,
        graceDays: planGraceDays,
        trialDays: planTrialDays,
        trialRemainingDays,
        graceRemainingDays,
      } : null,
      entitlements: entitlements.map(e => ({ code: e.code, currentPeriodEnd: e.currentPeriodEnd?.toISOString() || null, status: e.status })),
      selections,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
