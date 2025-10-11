import type { NextRequest } from 'next/server';
// Removed unused Clerk imports
import { ensureAdmin as requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ensureAdmin = requireAdmin;

export async function GET() {
  const admin = await ensureAdmin(); if (!admin.ok) return new Response(JSON.stringify({ error: admin.error }), { status: admin.error === 'Unauthorized' ? 401 : 403, headers: { 'Content-Type': 'application/json' } });
  const rows = await prisma.planConfig.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      planId: true,
      name: true,
      subtitle: true,
      color: true,
      popular: true,
      comingSoon: true,
      featuresJson: true,
      entitlementsJson: true,
      entitlementProjectsJson: true,
      currency: true,
      priceMonthlyId: true,
      priceYearlyId: true,
      trialDays: true,
      graceDays: true,
      sortOrder: true,
      createdAt: true,
      stripeProductId: true,
    },
  });
  return new Response(JSON.stringify({ items: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function DELETE(req: NextRequest) {
  const admin = await ensureAdmin(); if (!admin.ok) return new Response(JSON.stringify({ error: admin.error }), { status: admin.error === 'Unauthorized' ? 401 : 403, headers: { 'Content-Type': 'application/json' } });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const archiveStripe = searchParams.get('archiveStripe') === 'true';
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try {
    if (archiveStripe) {
      const row = await prisma.planConfig.findUnique({ where: { id } });
      if (row?.stripeProductId && process.env.STRIPE_SECRET_KEY) {
        const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
        try { await stripe.products.update(row.stripeProductId, { active: false }); } catch {}
        if (row.priceMonthlyId) { try { await stripe.prices.update(row.priceMonthlyId, { active: false }); } catch {} }
        if (row.priceYearlyId) { try { await stripe.prices.update(row.priceYearlyId, { active: false }); } catch {} }
      }
    }
    await prisma.planConfig.delete({ where: { id } });
  } catch {}
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function PATCH(req: NextRequest) {
  const admin = await ensureAdmin(); if (!admin.ok) return new Response(JSON.stringify({ error: admin.error }), { status: admin.error === 'Unauthorized' ? 401 : 403, headers: { 'Content-Type': 'application/json' } });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const { sortOrder } = await req.json().catch(()=>({}));
  if (!id || typeof sortOrder !== 'number') return new Response(JSON.stringify({ error: 'Missing id or sortOrder' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  await prisma.planConfig.update({ where: { id }, data: { sortOrder } }).catch(()=>undefined);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
