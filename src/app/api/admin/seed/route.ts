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

type SeedPlan = {
  planId: string;
  name: string;
  monthly: number; // USD
  yearly: number; // USD
  trialDays: number;
  graceDays: number;
  subtitle?: string;
  color?: string;
  popular?: boolean;
  comingSoon?: boolean;
  features: string[];
  entitlements: string[];
};

const DEFAULT_PLANS: SeedPlan[] = [
  {
    planId: 'apprentice',
    name: 'Apprentice',
    monthly: 15,
    yearly: 144,
    trialDays: 7,
    graceDays: 3,
    subtitle: 'Perfecto para 1 solución',
    color: '#ff00dd',
    popular: true,
    comingSoon: false,
    features: [
      '1 app a elección (POS, WhatsApp IA, Taller o Retail)',
      'Actualizaciones automáticas',
      'Soporte básico por email',
    ],
    entitlements: ['pos.basic'],
  },
  {
    planId: 'mage',
    name: 'Mage',
    monthly: 39,
    yearly: 374,
    trialDays: 14,
    graceDays: 3,
    subtitle: 'Para negocios en crecimiento',
    color: '#00ffe1',
    popular: false,
    comingSoon: false,
    features: [
      'Acceso a 3 apps a elección',
      'Soporte prioritario (chat + email)',
      'Reportes básicos de rendimiento',
    ],
    entitlements: ['pos.pro', 'sas.basic'],
  },
  {
    planId: 'archmage',
    name: 'Archmage',
    monthly: 79,
    yearly: 758,
    trialDays: 0,
    graceDays: 3,
    subtitle: 'Todas las apps + funciones avanzadas',
    color: '#ffae00',
    popular: false,
    comingSoon: true,
    features: [
      'Acceso ilimitado a todas las apps',
      'Soporte 24/7 premium',
      'Reportes avanzados y analítica IA',
      'Integraciones personalizadas (API)',
    ],
    entitlements: ['pos.enterprise', 'sas.pro'],
  },
];

export async function POST(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });

    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get('confirm');
    if (!confirm) {
      return new Response(JSON.stringify({ error: 'Add ?confirm=1 to proceed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    if (!secret.startsWith('sk_test_')) return new Response(JSON.stringify({ error: 'Refusing to seed in non-test Stripe' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);

    const results: Array<{ planId: string; productId: string; priceMonthlyId?: string | null; priceYearlyId?: string | null }> = [];

    for (const p of DEFAULT_PLANS) {
      const lookup = p.planId.replace(/[^a-z0-9]/gi, '').toUpperCase();
      // create or update product
      const product = await stripe.products.create({
        name: p.name,
        active: true,
        metadata: { planId: p.planId, trialDays: String(p.trialDays) },
      });
      // prices
      const priceM = await stripe.prices.create({ product: product.id, currency: 'usd', unit_amount: Math.round(p.monthly * 100), active: true, recurring: { interval: 'month' }, lookup_key: `${lookup}_M` });
      const priceY = await stripe.prices.create({ product: product.id, currency: 'usd', unit_amount: Math.round(p.yearly * 100), active: true, recurring: { interval: 'year' }, lookup_key: `${lookup}_Y` });

      // upsert PlanConfig
      await prisma.planConfig.upsert({
        where: { planId: p.planId },
        update: {
          name: p.name,
          stripeProductId: product.id,
          priceMonthlyId: priceM.id,
          priceYearlyId: priceY.id,
          currency: 'usd',
          trialDays: p.trialDays,
          graceDays: p.graceDays,
          subtitle: p.subtitle,
          color: p.color,
          popular: !!p.popular,
          comingSoon: !!p.comingSoon,
          featuresJson: JSON.stringify(p.features),
          entitlementsJson: JSON.stringify(p.entitlements),
        },
        create: {
          planId: p.planId,
          name: p.name,
          stripeProductId: product.id,
          priceMonthlyId: priceM.id,
          priceYearlyId: priceY.id,
          currency: 'usd',
          trialDays: p.trialDays,
          graceDays: p.graceDays,
          subtitle: p.subtitle,
          color: p.color,
          popular: !!p.popular,
          comingSoon: !!p.comingSoon,
          featuresJson: JSON.stringify(p.features),
          entitlementsJson: JSON.stringify(p.entitlements),
        },
      });

      results.push({ planId: p.planId, productId: product.id, priceMonthlyId: priceM.id, priceYearlyId: priceY.id });
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

