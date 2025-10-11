import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
// Removed unused Clerk imports
import { ensureAdmin as requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ensureAdmin = requireAdmin;

export async function POST(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);
    const body = await req.json().catch(()=>({}));
    const { code, percentOff, duration = 'once', durationInMonths, maxRedemptions, appliesToPlanId } = body as { code?: string; percentOff?: number; duration?: 'once'|'repeating'|'forever'; durationInMonths?: number; maxRedemptions?: number; appliesToPlanId?: string };
    if (!code || !percentOff) return new Response(JSON.stringify({ error: 'Missing code or percentOff' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    let products: string[] | undefined = undefined;
    if (appliesToPlanId) {
      const cfg = await prisma.planConfig.findUnique({ where: { planId: appliesToPlanId.toLowerCase() } });
      if (cfg?.stripeProductId) products = [cfg.stripeProductId];
    }
    const coupon = await stripe.coupons.create({ percent_off: percentOff, duration, duration_in_months: duration === 'repeating' ? durationInMonths : undefined, max_redemptions: maxRedemptions, applies_to: products ? { products } : undefined });
    const promo = await stripe.promotionCodes.create({ coupon: coupon.id, code, active: true });
    return new Response(JSON.stringify({ ok: true, coupon: coupon.id, promotion_code: promo.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function GET(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
    const secret = process.env.STRIPE_SECRET_KEY; if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);
    const { searchParams } = new URL(req.url);
    const active = searchParams.get('active');
    const pc = await stripe.promotionCodes.list({ active: active ? active === 'true' : undefined, limit: 50 });
    const data = pc.data.map(p => ({ id: p.id, code: p.code, active: p.active, coupon: (typeof p.coupon === 'string' ? p.coupon : p.coupon?.id) || undefined, times_redeemed: (p as unknown as { times_redeemed?: number }).times_redeemed }));
    return new Response(JSON.stringify({ items: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
    const secret = process.env.STRIPE_SECRET_KEY; if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const promo = await stripe.promotionCodes.update(id, { active: false });
    return new Response(JSON.stringify({ ok: true, id: promo.id, active: promo.active }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
