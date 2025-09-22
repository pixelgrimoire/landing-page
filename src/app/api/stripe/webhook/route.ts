import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { mapPriceIdsToEntitlements, revokeAllEntitlementsForCustomer, upsertUserEntitlements } from '@/lib/entitlements';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getStripe(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret);
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: 'STRIPE_WEBHOOK_SECRET not configured' }), { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const sig = req.headers.get('stripe-signature');
    if (!sig) throw new Error('Missing Stripe-Signature');
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid webhook signature';
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Útil para enlazar el customer con tu usuario interno (mediante metadata)
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[stripe] checkout.session.completed', {
          customer: session.customer,
          customer_email: session.customer_details?.email || session.customer_email,
          metadata: session.metadata,
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);
        const priceIds = sub.items.data.map((it) => it.price.id);
        const entitlements = mapPriceIdsToEntitlements(priceIds);

        // Upsert Customer (email opcional via expand)
        try {
          const customer = typeof sub.customer === 'string' ? await prisma.customer.upsert({
            where: { id: customerId },
            update: {},
            create: { id: customerId },
          }) : null;
        } catch {}

        // Upsert Subscription
        await prisma.subscription.upsert({
          where: { stripeId: sub.id },
          update: {
            customerId,
            status: sub.status,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          },
          create: {
            stripeId: sub.id,
            customerId,
            status: sub.status,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          },
        });

        // Sync items
        const dbSub = await prisma.subscription.findUniqueOrThrow({ where: { stripeId: sub.id } });
        const existingItems = await prisma.subscriptionItem.findMany({ where: { subscriptionId: dbSub.id } });
        const existingByStripeId = new Map(existingItems.map(i => [i.stripeItemId, i] as const));

        for (const item of sub.items.data) {
          const stripeItemId = item.id;
          await prisma.subscriptionItem.upsert({
            where: { stripeItemId },
            update: {
              subscriptionId: dbSub.id,
              stripePriceId: item.price.id,
              stripeProductId: typeof item.price.product === 'string' ? item.price.product : item.price.product?.id,
              quantity: item.quantity || 1,
            },
            create: {
              stripeItemId,
              subscriptionId: dbSub.id,
              stripePriceId: item.price.id,
              stripeProductId: typeof item.price.product === 'string' ? item.price.product : item.price.product?.id,
              quantity: item.quantity || 1,
            },
          });
          existingByStripeId.delete(stripeItemId);
        }

        // Opcional: eliminar items que ya no existen en Stripe
        for (const leftover of existingByStripeId.values()) {
          await prisma.subscriptionItem.delete({ where: { stripeItemId: leftover.stripeItemId } });
        }

        await upsertUserEntitlements({
          stripeCustomerId: customerId,
          entitlements,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);
        await revokeAllEntitlementsForCustomer(customerId);
        // Opcional: marcar subscripción como cancelada
        await prisma.subscription.update({
          where: { stripeId: sub.id },
          data: { status: sub.status },
        }).catch(() => undefined);
        break;
      }

      // Opcional: maneja pagos fallidos para aplicar "grace period" o restricciones
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[stripe] invoice.payment_failed', {
          customer: invoice.customer,
          subscription: invoice.subscription,
        });
        break;
      }

      default: {
        // Otros eventos pueden ignorarse o registrarse
        // console.log('[stripe] event', event.type);
        break;
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unhandled error';
    console.error('[stripe] handler error', msg);
    return new Response(`Handler Error: ${msg}`, { status: 500 });
  }
}
