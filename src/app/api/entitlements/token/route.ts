import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { signJwtHS256 } from '@/lib/jwt';

export const runtime = 'nodejs';

function buildCorsHeaders(req: NextRequest): Record<string, string> {
  const vary = 'Origin';
  const hdrs: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': vary,
  };
  const allowed = (process.env.ENTITLEMENTS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('origin') || '';
  if (origin && allowed.some((a) => a.toLowerCase() === origin.toLowerCase())) {
    hdrs['Access-Control-Allow-Origin'] = origin;
    hdrs['Access-Control-Allow-Credentials'] = 'true';
  }
  return hdrs;
}

export async function OPTIONS(req: NextRequest) {
  const headers = buildCorsHeaders(req);
  return new Response(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const baseHeaders = { 'Content-Type': 'application/json', ...buildCorsHeaders(req) };
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: baseHeaders });

    const body = (await req.json().catch(() => ({}))) as { entitlementCode?: string; aud?: string };
    const requestedEntitlement = (body.entitlementCode || '').trim();
    const requestedAud = (body.aud || '').trim().toLowerCase();

    const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
    if (!user?.stripeCustomerId) return new Response(JSON.stringify({ error: 'No Stripe customer linked' }), { status: 400, headers: baseHeaders });

    const activeEnts = await prisma.entitlement.findMany({ where: { customerId: user.stripeCustomerId, status: { in: ['active','trialing','past_due'] } } });
    const entitlements = activeEnts.map(e => e.code);

    // If audience is requested, ensure it matches the user's current selection for that entitlement
    let aud: string | undefined = undefined;
    if (requestedAud) {
      const entitlementCode = requestedEntitlement || entitlements[0]; // choose first if not provided
      if (!entitlementCode) return new Response(JSON.stringify({ error: 'No entitlement available for audience scoping' }), { status: 400, headers: baseHeaders });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = prisma as any;
      const sel = await p.projectSelection.findUnique({ where: { customerId_entitlementCode: { customerId: user.stripeCustomerId, entitlementCode } } }).catch(() => null);
      const now = new Date();
      let current = sel?.currentProject as string | null | undefined;
      if (sel?.pendingProject && sel.pendingEffectiveAt && sel.pendingEffectiveAt <= now) {
        current = sel.pendingProject;
        try {
          await p.projectSelection.update({ where: { customerId_entitlementCode: { customerId: user.stripeCustomerId, entitlementCode } }, data: { currentProject: current, pendingProject: null, pendingEffectiveAt: null } });
        } catch {}
      }
      if (!current || current !== requestedAud) {
        return new Response(JSON.stringify({ error: 'Audience not allowed for current period' }), { status: 403, headers: baseHeaders });
      }
      aud = requestedAud;
    }

    const secret = process.env.ENTITLEMENTS_JWT_SECRET;
    if (!secret) return new Response(JSON.stringify({ error: 'ENTITLEMENTS_JWT_SECRET not configured' }), { status: 500, headers: baseHeaders });

    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      sub: userId,
      customerId: user.stripeCustomerId,
      entitlements,
      iat: now,
      exp: now + 60 * 10, // 10 minutes
      iss: 'pixelgrimoire.com',
    };
    if (aud) payload.aud = aud;

    const token = signJwtHS256(payload, secret);
    return new Response(
      JSON.stringify({ token, entitlements, customerId: user.stripeCustomerId, expiresIn: 600 }),
      { status: 200, headers: baseHeaders }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    // Best-effort CORS on error as well
    // NOTE: We cannot rebuild headers without the request; default to permissive vary only
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
