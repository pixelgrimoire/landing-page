#!/usr/bin/env node
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';

// Minimal .env loader for standalone scripts
function loadDotEnv() {
  try {
    const file = path.join(process.cwd(), '.env');
    if (!fs.existsSync(file)) return;
    const txt = fs.readFileSync(file, 'utf8');
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

loadDotEnv();

const key = process.env.STRIPE_SECRET_KEY || '';
if (!key) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to wipe: STRIPE key is not test mode');
  process.exit(2);
}

const stripe = new Stripe(key);

async function listAll(iterator) {
  const out = [];
  let starting_after = undefined;
  while (true) {
    const page = await iterator({ limit: 100, starting_after });
    out.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return out;
}

async function main() {
  console.log('[stripe] Using key', key.slice(0, 8) + '...' + key.slice(-4));

  console.log('[stripe] Cancelling subscriptions...');
  const subs = await listAll((params)=> stripe.subscriptions.list({ ...params, status: 'all' }));
  console.log(`  found ${subs.length} subscriptions`);
  for (const s of subs) {
    try {
      await stripe.subscriptions.cancel(s.id);
      console.log('  cancelled', s.id, s.status);
    } catch (e) { console.warn('  cancel failed', s.id, e?.message || e); }
  }

  console.log('[stripe] Deleting customers...');
  const customers = await listAll((params)=> stripe.customers.list(params));
  console.log(`  found ${customers.length} customers`);
  for (const c of customers) {
    try {
      // detach payment methods first to avoid constraints
      const pms = await listAll((params)=> stripe.paymentMethods.list({ ...params, customer: c.id, type: 'card' }));
      for (const pm of pms) {
        try { await stripe.paymentMethods.detach(pm.id); } catch {}
      }
      await stripe.customers.del(c.id);
      console.log('  deleted customer', c.id);
    } catch (e) { console.warn('  delete customer failed', c.id, e?.message || e); }
  }

  console.log('[stripe] Disabling prices...');
  const prices = await listAll((params)=> stripe.prices.list(params));
  console.log(`  found ${prices.length} prices`);
  for (const p of prices) {
    try { if (p.active) {
      await stripe.prices.update(p.id, { active: false });
      console.log('  deactivated price', p.id);
    }} catch (e) { console.warn('  deactivate price failed', p.id, e?.message || e); }
  }

  console.log('[stripe] Deleting products...');
  const products = await listAll((params)=> stripe.products.list(params));
  console.log(`  found ${products.length} products`);
  for (const pr of products) {
    try {
      await stripe.products.del(pr.id);
      console.log('  deleted product', pr.id);
    } catch (e) {
      try {
        await stripe.products.update(pr.id, { active: false });
        console.log('  deactivated product', pr.id);
      } catch (e2) { console.warn('  delete/deactivate product failed', pr.id, e2?.message || e2); }
    }
  }

  console.log('[stripe] Cleaning coupons & promotion codes...');
  const coupons = await listAll((params)=> stripe.coupons.list(params));
  console.log(`  found ${coupons.length} coupons`);
  for (const cp of coupons) {
    try {
      await stripe.coupons.del(cp.id);
      console.log('  deleted coupon', cp.id);
    } catch (e) { console.warn('  delete coupon failed', cp.id, e?.message || e); }
  }
  const promoCodes = await listAll((params)=> stripe.promotionCodes.list(params));
  console.log(`  found ${promoCodes.length} promotion codes`);
  for (const pc of promoCodes) {
    try { if (pc.active) {
      await stripe.promotionCodes.update(pc.id, { active: false });
      console.log('  deactivated promo', pc.id);
    }} catch (e) { console.warn('  deactivate promo failed', pc.id, e?.message || e); }
  }

  console.log('[stripe] wipe complete');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
