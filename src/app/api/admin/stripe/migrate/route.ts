import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function ensureAdmin() {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, status: 401, error: 'Unauthorized' };
  const clerk = await clerkClient();
  const u = await clerk.users.getUser(userId);
  const email = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || '';
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes((email || '').toLowerCase())) return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);

    const { planId, target } = await req.json() as { planId?: string; target?: 'monthly'|'yearly' };
    if (!planId || !target) return new Response(JSON.stringify({ error: 'Missing planId or target' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const cfg = await prisma.planConfig.findUnique({ where: { planId: planId.toLowerCase() } });
    if (!cfg) return new Response(JSON.stringify({ error: 'Plan not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const newPriceId = target === 'monthly' ? cfg.priceMonthlyId : cfg.priceYearlyId;
    const oldPriceId = target === 'monthly' ? cfg.priceYearlyId : cfg.priceMonthlyId;
    if (!newPriceId) return new Response(JSON.stringify({ error: 'New priceId missing' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // Fetch active subs on the counterpart price
    const subs = await stripe.subscriptions.list({ status: 'active', price: oldPriceId || undefined, limit: 100 });
    let migrated = 0;
    for (const s of subs.data) {
      // find the item that matches oldPrice (or any if undefined)
      const item = s.items.data.find(i => (oldPriceId ? i.price.id === oldPriceId : true));
      if (!item) continue;
      await stripe.subscriptions.update(s.id, {
        items: [{ id: item.id, price: newPriceId }],
        proration_behavior: 'none',
      }).catch(()=>undefined);
      migrated++;
    }
    return new Response(JSON.stringify({ ok: true, migrated, total: subs.data.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

