import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureDbUserFromClerk } from '@/lib/clerkUser';
import { ensureStripeCustomerForUser, findOrCreateStripeCustomerIdByEmail } from '@/lib/stripeCustomer';

export const runtime = 'nodejs';

type CustomerAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export async function POST(req: NextRequest) {
  try {
  const { planId, billingCycle, email, promotionCode, customerDetails } = (await req.json()) as {
      planId?: string;
      billingCycle?: 'monthly' | 'yearly';
      email?: string;
      promotionCode?: string;
      customerDetails?: { address?: CustomerAddress; name?: string; email?: string };
    };
    if (!planId || !billingCycle) {
      return new Response(JSON.stringify({ error: 'Missing planId or billingCycle' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

  const stripe = new Stripe(secret);

    const pid = planId.toString().replace(/[^a-z0-9]/gi, '').toUpperCase();
    let priceId: string | undefined;
    try {
      const cfg = await (await import('@/lib/prisma')).prisma.planConfig.findUnique({ where: { planId: planId.toString().toLowerCase() } });
      priceId = billingCycle === 'yearly' ? (cfg?.priceYearlyId || undefined) : (cfg?.priceMonthlyId || undefined);
    } catch {}
    if (!priceId) {
      const key = `STRIPE_PRICE_${pid}_${billingCycle === 'yearly' ? 'Y' : 'M'}` as const;
      priceId = (process.env as Record<string, string | undefined>)[key];
    }
    if (!priceId) {
      const msgKey = `STRIPE_PRICE_${pid}_${billingCycle === 'yearly' ? 'Y' : 'M'}`;
      return new Response(JSON.stringify({ error: `Falta configurar ${msgKey}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Determine or create customer
    let customerId: string | undefined;
    const { userId } = await auth();
    if (userId) {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
      const primaryEmail = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || undefined;
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || undefined;
      const dbUser = await ensureDbUserFromClerk({ clerkUserId: userId, email: primaryEmail, name, image: u.imageUrl });
      const ensured = await ensureStripeCustomerForUser({ userId: dbUser.id, email: primaryEmail, name, currentCustomerId: dbUser.stripeCustomerId || null });
      if (ensured) customerId = ensured;
    } else if (email && email.includes('@')) {
      const id = await findOrCreateStripeCustomerIdByEmail(email);
      if (id) customerId = id;
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'No se pudo determinar el cliente. Inicia sesión o proporciona un email válido.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Optional: validate promotion code
    let promotion_code_id: string | undefined;
    let promotion_invalid = false;
    if (promotionCode && promotionCode.trim()) {
      const promos = await stripe.promotionCodes.list({ code: promotionCode.trim(), active: true, limit: 1 });
      const pc = promos.data[0];
      if (!pc) {
        // Don't fail the whole request; carry on without a discount and mark invalid
        promotion_invalid = true;
      } else {
        promotion_code_id = pc.id;
      }
    }

    // If we received an address, normalize and update the Customer before creating the subscription
    try {
      const normAddress = (a?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null) => {
        if (!a) return undefined;
        const line1 = (a.line1 || '').trim();
        const line2 = (a.line2 || '').trim();
        if (!line1 && line2) return { ...a, line1: line2, line2: undefined };
        return a;
      };
      if (customerId && customerDetails?.address) {
        await stripe.customers.update(customerId, { address: normAddress(customerDetails.address) });
      }
    } catch {}

    // Check if customer already has a usable address for Automatic Tax
    let hasLocation = false;
    try {
      if (customerId) {
        const resp = await stripe.customers.retrieve(customerId);
        const cust = resp as unknown as { address?: { country?: string }; shipping?: { address?: { country?: string } } };
        const billing: string | undefined = cust.address?.country;
        const shippingCountry: string | undefined = cust.shipping?.address?.country;
        hasLocation = Boolean(billing || shippingCountry);
      }
    } catch {}

    // Trial mapping per plan
    const planUpper = planId.toString().toLowerCase();
    const trialDays = planUpper === 'apprentice' ? 7 : planUpper === 'mage' ? 14 : 0;

    // Create subscription in incomplete state to collect payment via Payment Element
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity: 1 }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      trial_period_days: trialDays > 0 ? trialDays : undefined,
      trial_settings: trialDays > 0 ? { end_behavior: { missing_payment_method: 'cancel' } } : undefined,
      // Enable automatic tax if we know or just updated customer's address
      automatic_tax: hasLocation || !!customerDetails?.address ? { enabled: true } : undefined,
      discounts: promotion_code_id ? [{ promotion_code: promotion_code_id }] : undefined,
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: { planId, billingCycle, promotionCode: promotionCode || '' },
    });

    // Get client_secret for PaymentIntent (immediate payment) or SetupIntent (trial/$0 now)
    type InvoiceWithPI = { payment_intent?: { client_secret?: string } | string | null };
    const latestInvoice = subscription.latest_invoice as InvoiceWithPI | string | null;
    const candidate = latestInvoice && typeof latestInvoice !== 'string' ? latestInvoice.payment_intent : undefined;
    const paymentIntentCS: string | undefined =
      candidate && typeof candidate !== 'string' ? candidate.client_secret ?? undefined : undefined;

    const psi = (subscription.pending_setup_intent ?? null) as { client_secret?: string } | string | null;
    const setupIntentCS: string | undefined = psi && typeof psi === 'object' ? psi.client_secret ?? undefined : undefined;

    // Fetch price details for UI summary
    const price = await stripe.prices.retrieve(priceId);
    const unit_amount = price.unit_amount ?? null;
    const currency = price.currency ?? 'usd';
    const interval = (price.recurring?.interval ?? (billingCycle === 'yearly' ? 'year' : 'month')) as 'day'|'week'|'month'|'year';

    if (paymentIntentCS) {
      return new Response(
        JSON.stringify({ client_secret: paymentIntentCS, subscription_id: subscription.id, intent_type: 'payment', price: { unit_amount, currency, interval }, planId, billingCycle, customer_id: customerId, price_id: priceId, promotion_invalid: promotion_invalid || undefined, trial_days: trialDays || undefined }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (setupIntentCS) {
      return new Response(
        JSON.stringify({ client_secret: setupIntentCS, subscription_id: subscription.id, intent_type: 'setup', price: { unit_amount, currency, interval }, planId, billingCycle, customer_id: customerId, price_id: priceId, promotion_invalid: promotion_invalid || undefined, trial_days: trialDays || undefined }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: create a standalone SetupIntent to collect a payment method
    const si = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      metadata: { from: 'subscription_elements_fallback', planId, billingCycle, subscription_id: subscription.id },
    });

    return new Response(
      JSON.stringify({ client_secret: si.client_secret, subscription_id: subscription.id, intent_type: 'setup', fallback: true, price: { unit_amount, currency, interval }, planId, billingCycle, customer_id: customerId, price_id: priceId, promotion_invalid: promotion_invalid || undefined, trial_days: trialDays || undefined }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
