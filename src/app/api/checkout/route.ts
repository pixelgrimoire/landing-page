import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomer';
import { ensureDbUserFromClerk } from '@/lib/clerkUser';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { planId, billingCycle, email } = await req.json() as { planId?: string; billingCycle?: 'monthly'|'yearly'; email?: string };
    if (!planId || !billingCycle) {
      return new Response(JSON.stringify({ error: 'Missing planId or billingCycle' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const stripe = new Stripe(secret);

    // Mapear planId + ciclo a un Price ID vía env, ej.: STRIPE_PRICE_APPRENTICE_M / STRIPE_PRICE_APPRENTICE_Y
    const pid = planId.toString().replace(/[^a-z0-9]/gi, '').toUpperCase();
    const key = `STRIPE_PRICE_${pid}_${billingCycle === 'yearly' ? 'Y' : 'M'}` as const;
    const priceId = (process.env as Record<string, string | undefined>)[key];
    if (!priceId) {
      return new Response(JSON.stringify({ error: `Falta configurar ${key}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;

    // Vincular Customer con usuario Clerk autenticado
    const { userId } = auth();
    let customerId: string | undefined = undefined;
    let internalUserId: string | undefined = undefined;
    if (userId) {
      const u = await clerkClient.users.getUser(userId);
      const primaryEmail = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || undefined;
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || undefined;
      const dbUser = await ensureDbUserFromClerk({ clerkUserId: userId, email: primaryEmail, name, image: u.imageUrl });
      internalUserId = dbUser.id;
      const ensured = await ensureStripeCustomerForUser({
        userId: dbUser.id,
        email: primaryEmail,
        name,
        currentCustomerId: dbUser.stripeCustomerId || null,
      });
      if (ensured) customerId = ensured;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      customer_email: !customerId && email && email.includes('@') ? email : undefined,
      allow_promotion_codes: true,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel#pricing`,
      client_reference_id: internalUserId,
      metadata: { planId, billingCycle, userId: internalUserId || '' },
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
