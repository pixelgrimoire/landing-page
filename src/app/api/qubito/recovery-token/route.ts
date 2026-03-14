import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { signJwtHS256 } from '@/lib/jwt';
import { matchesAppEntitlement } from '@/lib/licenseApps';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
    if (!user?.stripeCustomerId) {
      return new Response(JSON.stringify({ error: 'No Stripe customer linked' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const activeEnts = await prisma.entitlement.findMany({
      where: {
        customerId: user.stripeCustomerId,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
    });
    const entitlements = activeEnts.map((e) => e.code);
    const qubitoEntitlements = entitlements.filter((code) => matchesAppEntitlement(code, 'qubito') || code.startsWith('pos.'));
    if (qubitoEntitlements.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing Qubito entitlement' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const secret = process.env.ENTITLEMENTS_JWT_SECRET;
    if (!secret) {
      return new Response(JSON.stringify({ error: 'ENTITLEMENTS_JWT_SECRET not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      sub: userId,
      customerId: user.stripeCustomerId,
      entitlements: qubitoEntitlements,
      purpose: 'qubito_local_recovery',
      iat: now,
      exp: now + 60 * 10,
      iss: 'pixelgrimoire.com',
      aud: 'qubito-recovery',
    };

    const token = signJwtHS256(payload, secret);
    return new Response(
      JSON.stringify({
        token,
        expiresIn: 600,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
