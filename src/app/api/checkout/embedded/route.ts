import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureDbUserFromClerk } from '@/lib/clerkUser';
import { ensureStripeCustomerForUser, findOrCreateStripeCustomerIdByEmail } from '@/lib/stripeCustomer';
import { prisma } from '@/lib/prisma';

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

    // Resolver precio y trial desde DB
    const planLower = planId.toString().toLowerCase();
    const cfg = await prisma.planConfig.findUnique({ where: { planId: planLower } });
    const priceId = billingCycle === 'yearly' ? (cfg?.priceYearlyId || undefined) : (cfg?.priceMonthlyId || undefined);
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Falta configurar el precio del plan en la base de datos' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;

    // Ensure Clerk user -> Stripe Customer if logged in
    const { userId } = await auth();
    let customer: string | undefined;
    if (userId) {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
      const primaryEmail = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || undefined;
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || undefined;
      const dbUser = await ensureDbUserFromClerk({ clerkUserId: userId, email: primaryEmail, name, image: u.imageUrl });
      const ensured = await ensureStripeCustomerForUser({ userId: dbUser.id, email: primaryEmail, name, currentCustomerId: dbUser.stripeCustomerId || null });
      if (ensured) customer = ensured;
    }

    const trialDays = cfg?.trialDays ?? 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      ui_mode: 'embedded',
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      // Require a billing address to reliably determine location for Automatic Tax
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      subscription_data: trialDays > 0 ? { trial_period_days: trialDays, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } } : undefined,
      customer_update: { address: 'auto', name: 'auto' },
      return_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { planId, billingCycle },
    };

    if (customer) {
      sessionParams.customer = customer;
    } else if (email && email.includes('@')) {
      const existingOrNew = await findOrCreateStripeCustomerIdByEmail(email);
      if (existingOrNew) {
        sessionParams.customer = existingOrNew;
      } else {
        sessionParams.customer_creation = 'if_required';
      }
    } else {
      sessionParams.customer_creation = 'if_required';
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ client_secret: session.client_secret }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
