import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomer';
import { ensureDbUserFromClerk } from '@/lib/clerkUser';
import { createToken, hashToken } from '@/lib/tokens';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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

    // Vincular Customer con usuario Clerk autenticado o generar claim token si es invitado
    const { userId } = await auth();
    let customerId: string | undefined = undefined;
    let internalUserId: string | undefined = undefined;
    let claimToken: string | undefined;
    if (userId) {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(userId);
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
    } else {
      // Invitado: generar claim token y guardarlo para vincular después del registro
      claimToken = createToken();
      const tokenHash = hashToken(claimToken);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
      await prisma.claimToken.create({ data: { tokenHash, email: (email && email.includes('@')) ? email : undefined, expiresAt } });
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      // Require a billing address to reliably determine location for Automatic Tax
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      success_url: claimToken ? `${origin}/register?token=${claimToken}` : `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel#pricing`,
      client_reference_id: internalUserId,
      metadata: { planId, billingCycle, userId: internalUserId || '', claimToken: claimToken || '' },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      if (email && email.includes('@')) sessionParams.customer_email = email;
      sessionParams.customer_creation = 'if_required';
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Set cookie con el claim token (si aplica) para restringir el acceso a /register
    if (claimToken) {
      const cookie = `pg_claim=${claimToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*60*24}`;
      const res = NextResponse.json({ url: session.url });
      res.headers.set('Set-Cookie', cookie);
      return res;
    }

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
