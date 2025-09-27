import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureDbUserFromClerk } from '@/lib/clerkUser';
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomer';

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

    const pid = planId.toString().replace(/[^a-z0-9]/gi, '').toUpperCase();
    const key = `STRIPE_PRICE_${pid}_${billingCycle === 'yearly' ? 'Y' : 'M'}` as const;
    const priceId = (process.env as Record<string, string | undefined>)[key];
    if (!priceId) {
      return new Response(JSON.stringify({ error: `Falta configurar ${key}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Ensure or create customer
    const { userId } = await auth();
    let customerId: string | undefined;
    if (userId) {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
      const primaryEmail = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || undefined;
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || undefined;
      const dbUser = await ensureDbUserFromClerk({ clerkUserId: userId, email: primaryEmail, name, image: u.imageUrl });
      const ensured = await ensureStripeCustomerForUser({ userId: dbUser.id, email: primaryEmail, name, currentCustomerId: dbUser.stripeCustomerId || null });
      if (ensured) customerId = ensured;
    }

    if (!customerId) {
      const created = await stripe.customers.create({ email: email && email.includes('@') ? email : undefined });
      customerId = created.id;
    }

    // Validate price is recurring; then decide flow based on trial/amount
    const price = await stripe.prices.retrieve(priceId);
    if (!price.recurring) {
      return new Response(
        JSON.stringify({ error: 'El Price no es recurrente. Usa un precio de suscripción.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const unitAmount = price.unit_amount || 0;
    const hasTrial = !!price.recurring?.trial_period_days && (price.recurring!.trial_period_days as number) > 0;

    // If the price has a trial, run a SetupIntent flow so we can collect a
    // payment method now and start the subscription immediately with a trial.
    if (hasTrial) {
      const setup = await stripe.setupIntents.create({ customer: customerId, usage: 'off_session' });
      return new Response(
        JSON.stringify({
          intent_type: 'setup',
          client_secret: setup.client_secret,
          customerId,
          amount: unitAmount,
          currency: price.currency,
          interval: price.recurring?.interval,
          trial_days: price.recurring?.trial_period_days || 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For non-trial subscriptions, require a positive amount and create a
    // default_incomplete subscription to get a PaymentIntent client_secret.
    if (unitAmount <= 0) {
      // $0 now, store a payment method with a SetupIntent for future cycles
      const setup = await stripe.setupIntents.create({ customer: customerId, usage: 'off_session' });
      return new Response(
        JSON.stringify({
          intent_type: 'setup',
          client_secret: setup.client_secret,
          customerId,
          amount: unitAmount,
          currency: price.currency,
          interval: price.recurring?.interval,
          trial_days: price.recurring?.trial_period_days || 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      collection_method: 'charge_automatically',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card', 'link'],
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: { planId, billingCycle },
    });

    // Attempt to extract client_secret reliably
    let clientSecret: string | undefined;
    const tryLoadClientSecret = async (sub: Stripe.Subscription) => {
      let cs: string | undefined;
      const li = (sub as unknown as { latest_invoice?: string | { payment_intent?: string | { client_secret?: string } } }).latest_invoice;
      if (li && typeof li !== 'string') {
        const pi = li.payment_intent as unknown;
        if (pi && typeof pi !== 'string') cs = (pi as { client_secret?: string }).client_secret || undefined;
        if (!cs && typeof pi === 'string') {
          const piObj = await stripe.paymentIntents.retrieve(pi);
          cs = piObj.client_secret || undefined;
        }
      }
      if (!cs && typeof sub.latest_invoice === 'string') {
        const inv = await stripe.invoices.retrieve(sub.latest_invoice, { expand: ['payment_intent'] }) as unknown as { payment_intent?: string | { client_secret?: string } };
        const pi = inv.payment_intent;
        if (pi && typeof pi !== 'string') cs = (pi as { client_secret?: string }).client_secret || undefined;
        if (!cs && typeof pi === 'string') {
          const piObj = await stripe.paymentIntents.retrieve(pi);
          cs = piObj.client_secret || undefined;
        }
      }
      return cs;
    };

    clientSecret = await tryLoadClientSecret(subscription);
    if (!clientSecret) {
      // Re-retrieve subscription expanded as sometimes PI is attached shortly after creation
      const refreshed = await stripe.subscriptions.retrieve(subscription.id, { expand: ['latest_invoice.payment_intent'] });
      clientSecret = await tryLoadClientSecret(refreshed);
    }

    if (!clientSecret) {
      // Fallback: if no PI was created (e.g., invoice due is 0 for first cycle),
      // create a SetupIntent so we can at least collect a PM and then finalize
      // by updating this subscription with default_payment_method on activation.
      const setup = await stripe.setupIntents.create({ customer: customerId, usage: 'off_session' });
      return new Response(
        JSON.stringify({
          intent_type: 'setup',
          client_secret: setup.client_secret,
          customerId,
          subscriptionId: subscription.id,
          amount: unitAmount,
          currency: price.currency,
          interval: price.recurring?.interval,
          trial_days: price.recurring?.trial_period_days || 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        intent_type: 'payment',
        client_secret: clientSecret,
        subscriptionId: subscription.id,
        amount: unitAmount,
        currency: price.currency,
        interval: price.recurring?.interval,
        trial_days: price.recurring?.trial_period_days || 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
