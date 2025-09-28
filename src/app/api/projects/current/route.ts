import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const { searchParams } = new URL(req.url);
    const entitlementCode = (searchParams.get('entitlementCode') || '').trim();
    if (!entitlementCode) return new Response(JSON.stringify({ error: 'entitlementCode is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
    if (!user?.stripeCustomerId) return new Response(JSON.stringify({ error: 'No Stripe customer linked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const customerId = user.stripeCustomerId;

    // any-cast until prisma generate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = prisma as any;
    let selection = await p.projectSelection.findUnique({ where: { customerId_entitlementCode: { customerId, entitlementCode } } });
    const now = new Date();
    if (selection?.pendingProject && selection.pendingEffectiveAt && selection.pendingEffectiveAt <= now) {
      selection = await p.projectSelection.update({
        where: { customerId_entitlementCode: { customerId, entitlementCode } },
        data: { currentProject: selection.pendingProject, pendingProject: null, pendingEffectiveAt: null },
      });
    }

    return new Response(JSON.stringify({ selection }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
