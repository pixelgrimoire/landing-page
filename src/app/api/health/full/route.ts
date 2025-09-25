import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

type Check = { ok: boolean; error?: string };

export async function GET() {
  const result: { ok: boolean; db: Check; stripe: Check & { keyPresent: boolean }; clerk: Check & { pubKeyPresent: boolean; secretPresent: boolean } } = {
    ok: false,
    db: { ok: false },
    stripe: { ok: false, keyPresent: !!process.env.STRIPE_SECRET_KEY },
    clerk: { ok: false, pubKeyPresent: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, secretPresent: !!process.env.CLERK_SECRET_KEY },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.db.ok = true;
  } catch (e) {
    result.db = { ok: false, error: e instanceof Error ? e.message : 'DB error' };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    result.stripe = { ok: false, keyPresent: false, error: 'Missing STRIPE_SECRET_KEY' };
  } else {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      // simple read request
      await stripe.products.list({ limit: 1 });
      result.stripe.ok = true;
    } catch (e) {
      result.stripe = { ok: false, keyPresent: true, error: e instanceof Error ? e.message : 'Stripe error' };
    }
  }

  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    result.clerk.ok = false;
    result.clerk.error = 'Missing Clerk keys';
  } else {
    try {
      const cc = await clerkClient();
      await cc.users.getUserList({ limit: 1 });
      result.clerk.ok = true;
    } catch (e) {
      result.clerk = {
        ok: false,
        pubKeyPresent: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        secretPresent: !!process.env.CLERK_SECRET_KEY,
        error: e instanceof Error ? e.message : 'Clerk error',
      };
    }
  }

  result.ok = result.db.ok && result.stripe.ok && result.clerk.ok;

  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

