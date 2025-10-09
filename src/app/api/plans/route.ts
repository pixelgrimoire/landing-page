import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const rows = await prisma.planConfig.findMany({ orderBy: { createdAt: 'asc' } });
    if (!rows?.length) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const secret = process.env.STRIPE_SECRET_KEY;
    const stripe = secret ? new Stripe(secret) : null;

    // Resolve amounts by fetching price objects
    const items = await Promise.all(rows.map(async (r) => {
      let priceM: number | null = null; let priceY: number | null = null;
      try {
        if (stripe && r.priceMonthlyId) { const p = await stripe.prices.retrieve(r.priceMonthlyId); priceM = (p.unit_amount ?? null); }
        if (stripe && r.priceYearlyId) { const p = await stripe.prices.retrieve(r.priceYearlyId); priceY = (p.unit_amount ?? null); }
      } catch {}
      const features = r.featuresJson ? (JSON.parse(r.featuresJson) as string[]) : [];
      return {
        id: r.planId,
        name: r.name,
        subtitle: r.subtitle || '',
        features,
        // return in major units (USD)
        priceM: priceM != null ? Math.round(priceM / 100) : null,
        priceY: priceY != null ? Math.round(priceY / 100) : null,
        popular: !!r.popular,
        comingSoon: !!r.comingSoon,
        color: r.color || '#ffffff',
      };
    }));
    return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

