import type { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const { customerId } = (await req.json()) as { customerId?: string };
    if (!customerId) return new Response(JSON.stringify({ error: 'Missing customerId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const stripe = new Stripe(secret);
    const cust = await stripe.customers.retrieve(customerId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const custAny = cust as any;
    const stripeEmail: string | undefined = custAny?.email || undefined;

    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    const primaryEmail = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || undefined;

    if (stripeEmail && primaryEmail && stripeEmail.trim().toLowerCase() !== primaryEmail.trim().toLowerCase()) {
      return new Response(JSON.stringify({ error: 'El email del cliente de Stripe no coincide con tu cuenta de Clerk.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || undefined;
    // Ensure local user exists and link stripeCustomerId
    const dbUser = await prisma.user.upsert({
      where: { clerkUserId: userId },
      update: { stripeCustomerId: customerId, name: name || undefined, email: primaryEmail || undefined, image: u.imageUrl || undefined },
      create: { clerkUserId: userId, stripeCustomerId: customerId, name: name || undefined, email: primaryEmail || undefined, image: u.imageUrl || undefined },
    });

    // Link the Customer row to this user
    await prisma.customer.upsert({
      where: { id: customerId },
      update: { email: stripeEmail || primaryEmail || undefined, userId: dbUser.id },
      create: { id: customerId, email: stripeEmail || primaryEmail || undefined, userId: dbUser.id },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

