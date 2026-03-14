import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
// Removed unused Clerk imports
import { ensureAdmin as requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ensureAdmin = requireAdmin;

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
    planId: 'qubito-apprentice',
    name: 'Qubito Apprentice',
    monthly: 15,
    yearly: 144,
    trialDays: 7,
    graceDays: 3,
    subtitle: 'Qubito para un punto de venta pequeño',
    color: '#ff00dd',
    popular: true,
    comingSoon: false,
    features: [
      'Qubito para una sola operación',
      'Actualizaciones automáticas',
      'Soporte básico por email',
    ],
    entitlements: ['qubito.apprentice'],
  },
  {
    planId: 'qubito-mage',
    name: 'Qubito Mage',
    monthly: 39,
    yearly: 374,
    trialDays: 14,
    graceDays: 3,
    subtitle: 'Qubito con capacidades extendidas',
    color: '#00ffe1',
    popular: false,
    comingSoon: false,
    features: [
      'Soporte prioritario',
      'Operación multiusuario extendida',
      'Reportes y controles adicionales',
    ],
    entitlements: ['qubito.mage'],
  },
  {
    planId: 'qubito-archmage',
    name: 'Qubito Archmage',
    monthly: 79,
    yearly: 758,
    trialDays: 0,
    graceDays: 3,
    subtitle: 'Qubito con soporte premium',
    color: '#ffae00',
    popular: false,
    comingSoon: false,
    features: [
      'Todas las funciones de Qubito',
      'Soporte premium',
      'Reportes avanzados',
      'Integraciones personalizadas',
    ],
    entitlements: ['qubito.archmage'],
  },
  {
    planId: 'nexora-apprentice',
    name: 'Nexora Apprentice',
    monthly: 15,
    yearly: 144,
    trialDays: 7,
    graceDays: 3,
    subtitle: 'Nexora para un taller pequeño',
    color: '#f97316',
    popular: false,
    comingSoon: false,
    features: [
      'Instalación local de Nexora',
      'Actualizaciones automáticas',
      'Soporte básico por email',
    ],
    entitlements: ['nexora.apprentice'],
  },
  {
    planId: 'nexora-mage',
    name: 'Nexora Mage',
    monthly: 39,
    yearly: 374,
    trialDays: 14,
    graceDays: 3,
    subtitle: 'Nexora con operación avanzada',
    color: '#06b6d4',
    popular: false,
    comingSoon: false,
    features: [
      'Más capacidad operativa',
      'Soporte prioritario',
      'Controles administrativos ampliados',
    ],
    entitlements: ['nexora.mage'],
  },
  {
    planId: 'nexora-archmage',
    name: 'Nexora Archmage',
    monthly: 79,
    yearly: 758,
    trialDays: 0,
    graceDays: 3,
    subtitle: 'Nexora con soporte premium',
    color: '#eab308',
    popular: false,
    comingSoon: false,
    features: [
      'Todas las funciones de Nexora',
      'Soporte premium',
      'Automatizaciones y monitoreo avanzados',
      'Integraciones personalizadas',
    ],
    entitlements: ['nexora.archmage'],
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
