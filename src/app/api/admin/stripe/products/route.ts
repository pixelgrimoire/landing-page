import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
// Removed unused Clerk imports
import { ensureAdmin as requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function cents(n?: number | string | null): number | null {
  if (n == null) return null;
  const num = typeof n === 'string' ? Number(n) : n;
  if (!isFinite(num)) return null;
  return Math.round(num * 100);
}

const ensureAdmin = requireAdmin;

export async function POST(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const body = await req.json().catch(()=> ({}));
    const { planId, name, currency = 'usd', amountMonthly, amountYearly, trialDays, graceDays, subtitle, color, popular, comingSoon, features, entitlements } = body as {
      planId?: string; name?: string; currency?: string; amountMonthly?: number | string; amountYearly?: number | string; trialDays?: number; graceDays?: number; subtitle?: string | null; color?: string | null; popular?: boolean; comingSoon?: boolean; features?: string[] | string; entitlements?: string[] | string;
    };
    if (!planId || !name || (amountMonthly == null && amountYearly == null)) {
      return new Response(JSON.stringify({ error: 'Missing planId, name or amounts' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const amountM = cents(amountMonthly);
    const amountY = cents(amountYearly);
    const stripe = new Stripe(secret);
    const idem = `pg_create_product_${planId}_${Date.now()}`;

    const product = await stripe.products.create({ name, active: true, metadata: { planId, trialDays: (trialDays ?? 0).toString() } }, { idempotencyKey: idem });
    const lookupBase = planId.toString().replace(/[^a-z0-9]/gi, '').toUpperCase();

    let priceMonthlyId: string | null = null;
    if (amountM != null) {
      const p = await stripe.prices.create({ product: product.id, currency, unit_amount: amountM, active: true, recurring: { interval: 'month' }, lookup_key: `${lookupBase}_M` });
      priceMonthlyId = p.id;
    }
    let priceYearlyId: string | null = null;
    if (amountY != null) {
      const p = await stripe.prices.create({ product: product.id, currency, unit_amount: amountY, active: true, recurring: { interval: 'year' }, lookup_key: `${lookupBase}_Y` });
      priceYearlyId = p.id;
    }

    const featuresJson = Array.isArray(features) ? JSON.stringify(features) : (typeof features === 'string' ? JSON.stringify(features.split('\n').map(s=>s.trim()).filter(Boolean)) : undefined);
    const entitlementsJson = Array.isArray(entitlements) ? JSON.stringify(entitlements) : (typeof entitlements === 'string' ? JSON.stringify(entitlements.split('\n').map(s=>s.trim()).filter(Boolean)) : undefined);
    // Optional mapping entitlement -> allowed project slugs
    let entitlementProjectsJson: string | undefined = undefined;
    const extra = body as unknown as { entitlementProjects?: Record<string, string[]> | string | null };
    if (extra.entitlementProjects && typeof extra.entitlementProjects === 'object') {
      entitlementProjectsJson = JSON.stringify(extra.entitlementProjects);
    } else if (typeof extra.entitlementProjects === 'string') {
      const txt = String(extra.entitlementProjects);
      const map: Record<string, string[]> = {};
      for (const ln of txt.split('\n')) {
        const line = ln.trim(); if (!line) continue;
        const idx = line.indexOf('='); if (idx === -1) continue;
        const code = line.slice(0, idx).trim();
        const vals = line.slice(idx+1).split(',').map(s=>s.trim()).filter(Boolean);
        if (code && vals.length) map[code] = vals;
      }
      entitlementProjectsJson = JSON.stringify(map);
    }
    await prisma.planConfig.upsert({ where: { planId: lookupBase.toLowerCase() }, update: {
      name, stripeProductId: product.id, priceMonthlyId: priceMonthlyId || undefined, priceYearlyId: priceYearlyId || undefined, currency, trialDays: typeof trialDays === 'number' ? trialDays : 0, graceDays: typeof graceDays === 'number' ? graceDays : 3,
      subtitle: subtitle ?? undefined, color: color ?? undefined, popular: !!popular, comingSoon: !!comingSoon, featuresJson: featuresJson ?? undefined, entitlementsJson: entitlementsJson ?? undefined, entitlementProjectsJson: entitlementProjectsJson ?? undefined,
    }, create: {
      planId: lookupBase.toLowerCase(), name, stripeProductId: product.id, priceMonthlyId: priceMonthlyId || undefined, priceYearlyId: priceYearlyId || undefined, currency, trialDays: typeof trialDays === 'number' ? trialDays : 0, graceDays: typeof graceDays === 'number' ? graceDays : 3,
      subtitle: subtitle ?? undefined, color: color ?? undefined, popular: !!popular, comingSoon: !!comingSoon, featuresJson: featuresJson ?? undefined, entitlementsJson: entitlementsJson ?? undefined, entitlementProjectsJson: entitlementProjectsJson ?? undefined,
    }});

    return new Response(JSON.stringify({ ok: true, productId: product.id, priceMonthlyId, priceYearlyId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);

    const body = await req.json().catch(()=>({}));
    const { planId, name, currency = 'usd', amountMonthly, amountYearly, trialDays, graceDays, productActive, productDescription, defaultPriceTarget, subtitle, color, popular, comingSoon, features, entitlements } = body as { planId?: string; name?: string; currency?: string; amountMonthly?: number; amountYearly?: number; trialDays?: number; graceDays?: number; productActive?: boolean; productDescription?: string | null; defaultPriceTarget?: 'monthly'|'yearly'|'none'; subtitle?: string | null; color?: string | null; popular?: boolean; comingSoon?: boolean; features?: string[] | string; entitlements?: string[] | string };
    if (!planId) return new Response(JSON.stringify({ error: 'Missing planId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const pid = planId.toString().toLowerCase();
    const cfg = await prisma.planConfig.findUnique({ where: { planId: pid } });
    if (!cfg?.stripeProductId) return new Response(JSON.stringify({ error: 'No stripeProductId stored. Crea primero con POST.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // Update basic product fields first (name/metadata/active/description)
    await stripe.products.update(cfg.stripeProductId, {
      name: name || cfg.name,
      active: typeof productActive === 'boolean' ? productActive : undefined,
      description: typeof productDescription === 'string' ? productDescription : undefined,
      metadata: { planId: pid, trialDays: String(typeof trialDays === 'number' ? trialDays : (cfg.trialDays || 0)) },
    });

    let priceMonthlyId = cfg.priceMonthlyId || null;
    let priceYearlyId = cfg.priceYearlyId || null;
    if (typeof amountMonthly === 'number' && isFinite(amountMonthly)) {
      if (priceMonthlyId) { try { await stripe.prices.update(priceMonthlyId, { active: false }); } catch {} }
      const p = await stripe.prices.create({ product: cfg.stripeProductId, currency, unit_amount: Math.round(amountMonthly * 100), recurring: { interval: 'month' }, lookup_key: `${pid.toUpperCase()}_M`, transfer_lookup_key: true });
      priceMonthlyId = p.id;
    }
    if (typeof amountYearly === 'number' && isFinite(amountYearly)) {
      if (priceYearlyId) { try { await stripe.prices.update(priceYearlyId, { active: false }); } catch {} }
      const p = await stripe.prices.create({ product: cfg.stripeProductId, currency, unit_amount: Math.round(amountYearly * 100), recurring: { interval: 'year' }, lookup_key: `${pid.toUpperCase()}_Y`, transfer_lookup_key: true });
      priceYearlyId = p.id;
    }

    const featuresJson = Array.isArray(features) ? JSON.stringify(features) : (typeof features === 'string' ? JSON.stringify(features.split('\n').map(s=>s.trim()).filter(Boolean)) : undefined);
    const entitlementsJson = Array.isArray(entitlements) ? JSON.stringify(entitlements) : (typeof entitlements === 'string' ? JSON.stringify(entitlements.split('\n').map(s=>s.trim()).filter(Boolean)) : undefined);
    const updated = await prisma.planConfig.update({ where: { planId: pid }, data: {
      name: name || cfg.name, currency, trialDays: typeof trialDays === 'number' ? trialDays : cfg.trialDays, graceDays: typeof graceDays === 'number' ? graceDays : cfg.graceDays,
      priceMonthlyId: priceMonthlyId || undefined, priceYearlyId: priceYearlyId || undefined,
      subtitle: subtitle ?? cfg.subtitle ?? undefined, color: color ?? cfg.color ?? undefined, popular: typeof popular === 'boolean' ? popular : cfg.popular, comingSoon: typeof comingSoon === 'boolean' ? comingSoon : cfg.comingSoon,
      featuresJson: featuresJson ?? cfg.featuresJson ?? undefined,
      entitlementsJson: entitlementsJson ?? cfg.entitlementsJson ?? undefined,
    }});

    // Optionally set default price to monthly/yearly (new or existing)
    if (defaultPriceTarget === 'monthly' && (priceMonthlyId || updated.priceMonthlyId)) {
      await stripe.products.update(cfg.stripeProductId, { default_price: (priceMonthlyId || updated.priceMonthlyId || undefined) as string });
    }
    if (defaultPriceTarget === 'yearly' && (priceYearlyId || updated.priceYearlyId)) {
      await stripe.products.update(cfg.stripeProductId, { default_price: (priceYearlyId || updated.priceYearlyId || undefined) as string });
    }

    return new Response(JSON.stringify({ ok: true, productId: cfg.stripeProductId, priceMonthlyId: updated.priceMonthlyId || null, priceYearlyId: updated.priceYearlyId || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function GET(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);
    const p = await stripe.products.retrieve(id);
    // Stripe types: default_price can be string | Price | null; active/description exist on the product
    const prod = p as unknown as { id: string; name: string; active?: boolean; default_price?: string | { id: string } | null; description?: string | null };
    const defaultPrice = typeof prod.default_price === 'object' && prod.default_price ? prod.default_price.id : (typeof prod.default_price === 'string' ? prod.default_price : null);
    return new Response(JSON.stringify({ id: prod.id, name: prod.name, active: prod.active ?? true, default_price: defaultPrice, description: prod.description ?? null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
