import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ensureDbUserFromClerk } from '@/lib/clerkUser';
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const stripe = new Stripe(secret);

    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    const primaryEmail = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || undefined;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || undefined;
    const dbUser = await ensureDbUserFromClerk({ clerkUserId: userId, email: primaryEmail, name, image: u.imageUrl });

    // Asegurar que tenemos Stripe Customer
    const ensuredCustomerId = await ensureStripeCustomerForUser({ userId: dbUser.id, email: primaryEmail, name, currentCustomerId: dbUser.stripeCustomerId || null });
    if (!ensuredCustomerId) {
      return new Response(JSON.stringify({ error: 'Could not ensure Stripe customer' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: ensuredCustomerId,
      return_url: origin,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
