import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getCurrentPeriodEndForEntitlement } from '@/lib/projectSelection';

export const runtime = 'nodejs';

// period end helper moved to lib/projectSelection

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const body = (await req.json()) as { entitlementCode?: string; project?: string };
    const entitlementCode = (body.entitlementCode || '').trim();
    const project = (body.project || '').trim().toLowerCase();
    if (!entitlementCode || !project) {
      return new Response(JSON.stringify({ error: 'entitlementCode and project are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
    if (!user?.stripeCustomerId) return new Response(JSON.stringify({ error: 'No Stripe customer linked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const customerId = user.stripeCustomerId;

    // Ensure entitlement is active for the customer
    const entitlement = await prisma.entitlement.findUnique({ where: { customerId_code: { customerId, code: entitlementCode } } });
    if (!entitlement || entitlement.status === 'inactive') {
      return new Response(JSON.stringify({ error: 'Entitlement not active' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Upsert selection
    const now = new Date();
  // Use any-cast until Prisma client is regenerated with ProjectSelection model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = prisma as any;
  let selection = await p.projectSelection.findUnique({ where: { customerId_entitlementCode: { customerId, entitlementCode } } });

    // Lazy roll-forward if pending is due
    if (selection?.pendingProject && selection.pendingEffectiveAt && selection.pendingEffectiveAt <= now) {
      selection = await p.projectSelection.update({
        where: { customerId_entitlementCode: { customerId, entitlementCode } },
        data: { currentProject: selection.pendingProject, pendingProject: null, pendingEffectiveAt: null },
      });
    }

    if (!selection) {
      selection = await p.projectSelection.create({
        data: {
          customerId,
          entitlementCode,
          currentProject: project,
        },
      });
      return new Response(JSON.stringify({ message: 'Project set', selection }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!selection.currentProject) {
      selection = await p.projectSelection.update({
        where: { customerId_entitlementCode: { customerId, entitlementCode } },
        data: { currentProject: project, pendingProject: null, pendingEffectiveAt: null },
      });
      return new Response(JSON.stringify({ message: 'Project set', selection }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (selection.currentProject === project) {
      return new Response(JSON.stringify({ message: 'Already selected', selection }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

  const effectiveAt = await getCurrentPeriodEndForEntitlement(customerId, entitlementCode);
    if (!effectiveAt) {
      // Fallback: 30 days from now
      const fallback = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      selection = await p.projectSelection.update({
        where: { customerId_entitlementCode: { customerId, entitlementCode } },
        data: { pendingProject: project, pendingEffectiveAt: fallback },
      });
      return new Response(JSON.stringify({ message: 'Change scheduled at period end (fallback 30d)', selection }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    selection = await p.projectSelection.update({
      where: { customerId_entitlementCode: { customerId, entitlementCode } },
      data: { pendingProject: project, pendingEffectiveAt: effectiveAt },
    });
    return new Response(JSON.stringify({ message: 'Change scheduled at period end', selection }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
