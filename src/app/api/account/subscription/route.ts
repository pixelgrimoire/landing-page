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
    const selections = await Promise.all(entitlements.map(async (e) => {
      const sel = await prisma.projectSelection.findUnique({ where: { customerId_entitlementCode: { customerId, entitlementCode: e.code } } }).catch(()=>null);
      return { entitlementCode: e.code, selection: sel || null };
    }));

    let planId: string | null = null;
    let planLabel: string | null = null;
    let planGraceDays: number | null = null;
    let planTrialDays: number | null = null;
    let interval: 'month' | 'year' | null = null;
    let subData: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: Date | null } | null = null;
    let stripeTrialEnd: Date | null = null;
    let upTotal: number | null = null;
    let upCurrency: string | null = null;
    let upStart: Date | null = null;
    let upEnd: Date | null = null;

    let priceIdsForEnt: string[] = [];

    async function loadUpcoming(stripe: Stripe, opts: { subscriptionId?: string | null; priceId?: string | null }) {
      try {
        let up: Stripe.Invoice | null = null;
        const invoices = stripe.invoices as unknown as { retrieveUpcoming: (params: Record<string, unknown>) => Promise<Stripe.Invoice> };
        if (opts.subscriptionId) {
          up = await invoices.retrieveUpcoming({ customer: customerId, subscription: opts.subscriptionId || undefined });
        }
        // Fallback: try by price if subscription preview didn't yield lines/amounts
        if (!up || !Array.isArray(up?.lines?.data) || up.lines.data.length === 0 || (up.total == null && (up as unknown as { subtotal?: number | null }).subtotal == null)) {
          if (opts.priceId) {
            up = await invoices.retrieveUpcoming({ customer: customerId, subscription_items: [{ price: opts.priceId, quantity: 1 }] });
        }
        }
        if (up) {
          const firstLine = Array.isArray(up.lines?.data) ? up.lines.data[0] : undefined;
          const ps = firstLine?.period?.start ? new Date(firstLine.period.start * 1000) : null;
          const pe = firstLine?.period?.end ? new Date(firstLine.period.end * 1000) : null;
          const cur = up.currency || firstLine?.currency || null;
          // Best-effort total: prefer up.total, else compute subtotal + tax
          const subtotal = (up as unknown as { subtotal?: number | null }).subtotal ?? null;
          const tax = (up as unknown as { tax?: number | null }).tax ?? 0;
          const total: number | null = (up.total != null) ? up.total : (subtotal != null ? subtotal + (tax || 0) : null);
          upTotal = total; upCurrency = cur; upStart = ps; upEnd = pe;
        }
      } catch {
        // ignore
      }
    }
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
            // If DB is missing currentPeriodEnd (common in early local dev), fetch it from Stripe
            if (!sub.currentPeriodEnd) {
              try {
                const liveSub = await stripe.subscriptions.retrieve(sub.stripeId);
                const cpe = (liveSub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
                const tEnd = (liveSub as Stripe.Subscription & { trial_end?: number | null }).trial_end ?? null;
                if (cpe) {
                  const cpeDate = new Date(cpe * 1000);
                  subData = { status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, currentPeriodEnd: cpeDate };
                  // Best-effort: persist so next calls don't need Stripe
                  await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: cpeDate } }).catch(()=>undefined);
                }
                if (tEnd) stripeTrialEnd = new Date(tEnd * 1000);
              } catch {}
            }
          }
        }
      } catch {}
      // Upcoming invoice (preview) with fallbacks
      try {
        const sk = process.env.STRIPE_SECRET_KEY;
        if (sk) {
          const stripe = new Stripe(sk);
          await loadUpcoming(stripe, { subscriptionId: sub.stripeId, priceId: item?.stripePriceId || null });
        }
      } catch {}

      // If we still don't have currentPeriodEnd and we have Stripe key, fetch subscription directly
      try {
        if (!sub.currentPeriodEnd && !subData) {
          const sk = process.env.STRIPE_SECRET_KEY;
          if (sk) {
            const stripe = new Stripe(sk);
            const liveSub = await stripe.subscriptions.retrieve(sub.stripeId);
            const cpe = (liveSub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
            if (cpe) {
              const cpeDate = new Date(cpe * 1000);
              subData = { status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, currentPeriodEnd: cpeDate };
              await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: cpeDate } }).catch(()=>undefined);
            }
          }
        }
      } catch {}

      // Use DB value unless we already populated from Stripe fallback above
      if (!subData) {
        subData = { status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, currentPeriodEnd: sub.currentPeriodEnd ?? null };
      }
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
            const preferX = prefer as Stripe.Subscription & { current_period_end?: number; trial_end?: number | null };
            const cpe = preferX.current_period_end;
            const tEnd = preferX.trial_end ?? null;
            subData = {
              status: prefer.status,
              cancelAtPeriodEnd: !!prefer.cancel_at_period_end,
              currentPeriodEnd: cpe ? new Date(cpe * 1000) : null,
            };
            if (tEnd) stripeTrialEnd = new Date(tEnd * 1000);
            // Also preview upcoming invoice
            try { await loadUpcoming(stripe, { subscriptionId: prefer.id, priceId: prefer.items?.data?.[0]?.price?.id || null }); } catch {}
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
    // Try to infer a period end when DB value is missing
    let inferredPeriodEnd: Date | null = subData?.currentPeriodEnd || null;
    if (!inferredPeriodEnd) {
      try {
        const entDates = entitlements
          .map((e: { currentPeriodEnd: Date | null }) => e.currentPeriodEnd)
          .filter((d: Date | null): d is Date => !!d)
          .sort((a: Date, b: Date) => +a - +b);
        if (entDates[0]) inferredPeriodEnd = entDates[0];
      } catch {}
    }
    if (!inferredPeriodEnd) {
      try {
        const selDates = selections
          .map((s: { selection: { pendingEffectiveAt?: Date | null } | null }) => s.selection?.pendingEffectiveAt ?? null)
          .filter((d: Date | null): d is Date => !!d)
          .sort((a: Date, b: Date) => +a - +b);
        if (selDates[0]) inferredPeriodEnd = selDates[0];
      } catch {}
    }
    // Note: do NOT use this estimate for trial end unless we have no Stripe data at all
    if (!inferredPeriodEnd && sub && typeof planTrialDays === 'number' && planTrialDays > 0) {
      // As a last resort for period end
      const est = new Date(+sub.createdAt + planTrialDays * 24 * 60 * 60 * 1000);
      if (+est > +now) inferredPeriodEnd = est;
    }

    // Choose the period end to expose. While trialing, prefer the actual trial end from Stripe.
    const effectivePeriodEnd = (subData?.status === 'trialing')
      ? (stripeTrialEnd || subData?.currentPeriodEnd || inferredPeriodEnd || null)
      : (subData?.currentPeriodEnd || inferredPeriodEnd || null);

    const trialRemainingDays = (subData?.status === 'trialing' && (stripeTrialEnd || effectivePeriodEnd))
      ? Math.max(0, Math.ceil((+(stripeTrialEnd || effectivePeriodEnd!) - +now) / (1000*60*60*24)))
      : null;
    const graceRemainingDays = (subData?.status === 'past_due' && effectivePeriodEnd && typeof planGraceDays === 'number')
      ? Math.max(0, Math.ceil(((+effectivePeriodEnd + (planGraceDays*24*60*60*1000)) - +now) / (1000*60*60*24)))
      : null;

    const nextInvoiceDate = (subData?.status === 'trialing')
      ? (stripeTrialEnd || effectivePeriodEnd || null)
      : (effectivePeriodEnd || null);

    // Expose only amount and date for upcoming invoice; omit period bounds to keep types simple

    return new Response(JSON.stringify({
      subscription: subData ? {
        status: subData.status,
        cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
        currentPeriodEnd: (stripeTrialEnd && subData.status === 'trialing' ? stripeTrialEnd : (subData.currentPeriodEnd || effectivePeriodEnd))?.toISOString() || null,
        planId,
        planLabel,
        interval,
        graceDays: planGraceDays,
        trialDays: planTrialDays,
        trialRemainingDays,
        graceRemainingDays,
        nextInvoiceDate: nextInvoiceDate ? nextInvoiceDate.toISOString() : null,
        nextInvoiceTotal: upTotal,
        nextInvoiceCurrency: upCurrency,
        nextInvoicePeriodStart: null,
        nextInvoicePeriodEnd: null,
      } : null,
      entitlements: entitlements.map(e => ({ code: e.code, currentPeriodEnd: e.currentPeriodEnd?.toISOString() || null, status: e.status })),
      selections,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
