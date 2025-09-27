import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const setupIntentId = url.searchParams.get('setup_intent');
  const planId = url.searchParams.get('plan');
  const billingCycle = (url.searchParams.get('cycle') || 'yearly') as 'monthly'|'yearly';
  const subscriptionId = url.searchParams.get('subscription');

  const origin = `${url.protocol}//${url.host}`;
  const redirect = (search: string) => NextResponse.redirect(`${origin}/?${search}`);

  try {
    if (!setupIntentId) return redirect('checkout=error&reason=missing_setup_intent');
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return redirect('checkout=error&reason=server_config');
    const stripe = new Stripe(secret);

    const si = await stripe.setupIntents.retrieve(setupIntentId);
    if (!si.customer || !si.payment_method) return redirect('checkout=error&reason=setup_incomplete');

    // Si venimos de un SetupIntent para una suscripción ya creada (con invoice inicial 0),
    // actualizamos esa suscripción con el método de pago por defecto y terminamos.
    if (subscriptionId) {
      try {
        await stripe.subscriptions.update(subscriptionId, {
          default_payment_method: typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id,
        });
        return redirect('checkout=success');
      } catch {
        // caemos al flujo de crear una suscripción nueva como respaldo
      }
    }

    // Map planId + cycle to price si no había suscripción previa
    if (!planId) return redirect('checkout=error&reason=missing_plan');
    const pid = planId.toString().replace(/[^a-z0-9]/gi, '').toUpperCase();
    const key = `STRIPE_PRICE_${pid}_${billingCycle === 'yearly' ? 'Y' : 'M'}` as const;
    const priceId = (process.env as Record<string, string | undefined>)[key];
    if (!priceId) return redirect(`checkout=error&reason=missing_price_${key}`);

    // Crear suscripción con trial (si el Price lo tiene) usando default_payment_method
    await stripe.subscriptions.create({
      customer: typeof si.customer === 'string' ? si.customer : si.customer.id,
      items: [{ price: priceId }],
      default_payment_method: typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id,
      expand: ['latest_invoice.payment_intent'],
      metadata: { planId, billingCycle, source: 'setup_to_subscription' },
    });

    return redirect('checkout=success');
  } catch (e: unknown) {
    return redirect('checkout=error&reason=exception');
  }
}
