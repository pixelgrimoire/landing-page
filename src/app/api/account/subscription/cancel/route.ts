import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const body = (await req.json().catch(() => ({}))) as { cancelAtPeriodEnd?: boolean };
    const cancelAtPeriodEnd = !!body.cancelAtPeriodEnd;

    const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
    if (!user?.stripeCustomerId) return new Response(JSON.stringify({ error: 'No Stripe customer linked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const sub = await prisma.subscription.findFirst({ where: { customerId: user.stripeCustomerId, status: { in: ['active','trialing','past_due'] } }, orderBy: { createdAt: 'desc' } });
    if (!sub) return new Response(JSON.stringify({ error: 'No active subscription found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const stripe = new Stripe(sk);
    const updated = await stripe.subscriptions.update(sub.stripeId, { cancel_at_period_end: cancelAtPeriodEnd });

    // reflect immediately in DB; webhook will also sync
    await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: !!updated.cancel_at_period_end, status: updated.status } }).catch(()=>undefined);

    return new Response(JSON.stringify({ ok: true, cancelAtPeriodEnd: !!updated.cancel_at_period_end }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

