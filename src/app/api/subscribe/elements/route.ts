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

    // Create subscription in incomplete state and return client_secret
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      collection_method: 'charge_automatically',
      expand: ['latest_invoice.payment_intent'],
      metadata: { planId, billingCycle },
    });

    // Attempt to extract client_secret reliably
    let clientSecret: string | undefined;
    const li = (subscription as unknown as { latest_invoice?: string | { payment_intent?: string | { client_secret?: string } } }).latest_invoice;
    if (li && typeof li !== 'string') {
      const pi = li.payment_intent;
      if (pi && typeof pi !== 'string') clientSecret = pi.client_secret as string | undefined;
      if (!clientSecret && typeof pi === 'string') {
        const piObj = await stripe.paymentIntents.retrieve(pi);
        clientSecret = piObj.client_secret || undefined;
      }
    }
    if (!clientSecret && typeof subscription.latest_invoice === 'string') {
      const inv = await stripe.invoices.retrieve(subscription.latest_invoice, { expand: ['payment_intent'] }) as unknown as { payment_intent?: string | { client_secret?: string } };
      const pi = inv.payment_intent;
      if (pi && typeof pi !== 'string') clientSecret = pi.client_secret || undefined;
      if (!clientSecret && typeof pi === 'string') {
        const piObj = await stripe.paymentIntents.retrieve(pi);
        clientSecret = piObj.client_secret || undefined;
      }
    }

    if (!clientSecret) {
      return new Response(
        JSON.stringify({ error: 'No client_secret from PaymentIntent. Revisa que el precio no tenga trial ni sea 0 y que la API use payment_behavior: default_incomplete.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ client_secret: clientSecret, subscriptionId: subscription.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
