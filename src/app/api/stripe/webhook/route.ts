import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { mapPriceIdsToEntitlements, revokeAllEntitlementsForCustomer, upsertUserEntitlements } from '@/lib/entitlements';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubscriptionExtra = {
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
};

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
        try {
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
          const internalUserId = session.metadata?.userId;
          const email = session.customer_details?.email || session.customer_email || undefined;
          const claimToken = session.metadata?.claimToken;
          if (customerId) {
            await prisma.customer.upsert({
              where: { id: customerId },
              update: { email: email ?? undefined, userId: internalUserId || undefined },
              create: { id: customerId, email: email ?? undefined, userId: internalUserId || undefined },
            });
            if (internalUserId) {
              await prisma.user.update({
                where: { id: internalUserId },
                data: { stripeCustomerId: customerId },
              }).catch(()=>undefined);
            }
            if (claimToken) {
              const tokenHash = hashToken(claimToken);
              await prisma.claimToken.updateMany({
                where: { tokenHash },
                data: { stripeCustomerId: customerId, email: email ?? undefined, status: 'bound' },
              });
              // Enviar email con enlace de continuación y alternativa de OTP
              if (email) {
                const origin = process.env.PUBLIC_APP_URL || '';
                const registerUrl = origin ? `${origin}/register?token=${encodeURIComponent(claimToken)}` : '/register?token=' + encodeURIComponent(claimToken);
                const otpUrl = origin ? `${origin}/claim/start?token=${encodeURIComponent(claimToken)}` : '/claim/start?token=' + encodeURIComponent(claimToken);
                const html = `
                  <p>Gracias por tu compra.</p>
                  <p>Continúa el registro aquí (mismo dispositivo/browser): <a href="${registerUrl}">Completar registro</a></p>
                  <p>¿Usarás otro dispositivo? Verifica tu email y continúa aquí: <a href="${otpUrl}">Reclamar compra con código</a></p>
                  <p>El enlace expira en 24 horas.</p>
                `;
                await sendEmail(email, 'Completa tu registro', html).catch(() => undefined);
              }
            }
          }
        } catch (e) {
          console.warn('[stripe] link customer->user failed', e);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);
        const priceIds = sub.items.data.map((it) => it.price.id);
        const entitlements = mapPriceIdsToEntitlements(priceIds);
        const sx = sub as Stripe.Subscription & SubscriptionExtra;
        const currentPeriodEndSec = sx.current_period_end ?? sx.currentPeriodEnd ?? null;
        const cancelAtPeriodEnd = sx.cancel_at_period_end ?? sx.cancelAtPeriodEnd ?? false;

        // Upsert Customer (email opcional via expand)
        try {
          await prisma.customer.upsert({
            where: { id: customerId },
            update: {},
            create: { id: customerId },
          }).catch(()=>undefined);
        } catch {}

        // Upsert Subscription
        await prisma.subscription.upsert({
          where: { stripeId: sub.id },
          update: {
            customerId,
            status: sub.status,
            currentPeriodEnd: currentPeriodEndSec ? new Date(currentPeriodEndSec * 1000) : null,
            cancelAtPeriodEnd: !!cancelAtPeriodEnd,
          },
          create: {
            stripeId: sub.id,
            customerId,
            status: sub.status,
            currentPeriodEnd: currentPeriodEndSec ? new Date(currentPeriodEndSec * 1000) : null,
            cancelAtPeriodEnd: !!cancelAtPeriodEnd,
          },
        });

        // Sync items
        const dbSub = await prisma.subscription.findUniqueOrThrow({ where: { stripeId: sub.id } });
        const existingItems = await prisma.subscriptionItem.findMany({ where: { subscriptionId: dbSub.id } });
        const existingByStripeId = new Map(existingItems.map((it: { stripeItemId: string }) => [it.stripeItemId, it] as const));

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
        for (const leftover of existingByStripeId.values() as Iterable<{ stripeItemId: string }>) {
          await prisma.subscriptionItem.delete({ where: { stripeItemId: leftover.stripeItemId } });
        }

        // Solo actualiza entitlements cuando la suscripción es utilizable
        // Evita otorgar permisos en estados "incomplete" o similares
        const grantableStatuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
        if (grantableStatuses.includes(sub.status)) {
          await upsertUserEntitlements({
            stripeCustomerId: customerId,
            entitlements,
            status: sub.status,
            currentPeriodEnd: currentPeriodEndSec ?? undefined,
          });
        }
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
        console.log('[stripe] invoice.payment_failed', { customer: invoice.customer });
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

