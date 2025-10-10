import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwtHS256 } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key') || '';
    const expected = process.env.ENTITLEMENTS_API_KEY;
    if (!expected || apiKey !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { token, expectedAud, entitlementCode } = (await req.json()) as { token?: string; expectedAud?: string; entitlementCode?: string };
    if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const secret = process.env.ENTITLEMENTS_JWT_SECRET;
    if (!secret) return new Response(JSON.stringify({ error: 'ENTITLEMENTS_JWT_SECRET not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const payload = verifyJwtHS256(token, secret);
    if (!payload) return new Response(JSON.stringify({ valid: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const customerId = payload.customerId as string | undefined;
    if (!customerId) return new Response(JSON.stringify({ valid: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    // Cross-check entitlements from DB as source of truth + apply grace by plan
    const activeEnts = await prisma.entitlement.findMany({ where: { customerId, status: { not: 'inactive' } } });
    // Build code -> graceDays map from PlanConfig
    const plans = await prisma.planConfig.findMany({ select: { entitlementsJson: true, graceDays: true } });
    const codeGrace = new Map<string, number>();
    for (const p of plans) {
      if (!p.entitlementsJson) continue;
      try {
        const arr = JSON.parse(p.entitlementsJson) as string[];
        for (const c of arr) codeGrace.set(c, p.graceDays ?? 0);
      } catch {}
    }
    const now = Date.now();
    const entitlements = activeEnts.filter(e => {
      const st = (e.status || '').toLowerCase();
      if (st === 'active' || st === 'trialing') return true;
      if (st === 'past_due') {
        const g = codeGrace.get(e.code) ?? 0;
        const end = e.currentPeriodEnd ? new Date(e.currentPeriodEnd).getTime() : 0;
        if (end && now <= end + g * 24 * 60 * 60 * 1000) return true;
      }
      return false;
    }).map(e => e.code);

    // If audience is expected, validate token 'aud' and current selection alignment
    if (expectedAud) {
      const aud = (payload.aud as string | undefined) || '';
      const expectedLower = expectedAud.toLowerCase();
      if (!aud || aud.toLowerCase() !== expectedLower) {
        return new Response(JSON.stringify({ valid: false, reason: 'aud mismatch' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const code = (entitlementCode || entitlements[0] || '').trim();
      if (code) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = prisma as any;
        const sel = await p.projectSelection.findUnique({ where: { customerId_entitlementCode: { customerId, entitlementCode: code } } }).catch(() => null);
        const now = new Date();
        let current = sel?.currentProject as string | null | undefined;
        if (sel?.pendingProject && sel.pendingEffectiveAt && sel.pendingEffectiveAt <= now) {
          current = sel.pendingProject;
          try {
            await p.projectSelection.update({ where: { customerId_entitlementCode: { customerId, entitlementCode: code } }, data: { currentProject: current, pendingProject: null, pendingEffectiveAt: null } });
          } catch {}
        }
        if (!current || current.toLowerCase() !== expectedLower) {
          return new Response(JSON.stringify({ valid: false, reason: 'selection mismatch' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    return new Response(JSON.stringify({ valid: true, sub: payload.sub, customerId, entitlements, exp: payload.exp, aud: payload.aud }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
