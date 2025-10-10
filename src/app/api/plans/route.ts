import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const runtime = 'nodejs';

// Simple in-memory cache (per warm server instance)
let CACHE: { ts: number; items: unknown[] } | null = null;
const TTL_MS = 60_000; // 60s

export async function GET(_req: NextRequest) {
  try {
    // Serve from cache if fresh
    if (CACHE && (Date.now() - CACHE.ts) < TTL_MS) {
      return new Response(JSON.stringify({ items: CACHE.items }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'X-Cache': 'HIT',
        },
      });
    }

    const rows = await prisma.planConfig.findMany({ orderBy: { createdAt: 'asc' } });
    if (!rows?.length) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const secret = process.env.STRIPE_SECRET_KEY;
    const stripe = secret ? new Stripe(secret) : null;

    // Resolve amounts by fetching price objects (parallel for M/Y per plan)
    const items = await Promise.all(rows.map(async (r) => {
      let priceM: number | null = null; let priceY: number | null = null;
      if (stripe) {
        try {
          const [pm, py] = await Promise.all([
            r.priceMonthlyId ? stripe.prices.retrieve(r.priceMonthlyId) : Promise.resolve(null),
            r.priceYearlyId ? stripe.prices.retrieve(r.priceYearlyId) : Promise.resolve(null),
          ]);
          priceM = pm && typeof pm === 'object' ? (pm.unit_amount ?? null) : null;
          priceY = py && typeof py === 'object' ? (py.unit_amount ?? null) : null;
        } catch {}
      }
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
    // Update cache
    CACHE = { ts: Date.now(), items };
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
