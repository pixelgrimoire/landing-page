import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { signJwtHS256 } from '@/lib/jwt';
import type { Metadata } from 'next';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Entitlements Callback',
};

type Props = {
  // Next.js 15: searchParams is now a Promise
  searchParams: Promise<{ entitlementCode?: string; aud?: string; origin?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { userId } = await auth();
  const params = await searchParams;
  const entitlementCode = (params?.entitlementCode || '').trim();
  const requestedAud = (params?.aud || '').trim().toLowerCase();
  const originParam = (params?.origin || '').trim();

  // Validate target origin against allowlist
  const allowed = (process.env.ENTITLEMENTS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const targetOrigin = allowed.find((a) => a.toLowerCase() === originParam.toLowerCase());

  let payload: { token?: string; entitlements?: string[]; customerId?: string; expiresIn?: number; error?: string } = {};

  try {
    if (!userId) {
      payload.error = 'Unauthorized';
    } else {
      const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
      if (!user?.stripeCustomerId) {
        payload.error = 'No Stripe customer linked';
      } else {
        const activeEnts = await prisma.entitlement.findMany({ where: { customerId: user.stripeCustomerId, status: { in: ['active','trialing','past_due'] } } });
        const entitlements = activeEnts.map((e) => e.code);

        // If audience is requested, ensure it matches the user's current selection for that entitlement
        if (requestedAud) {
          const code = entitlementCode || entitlements[0];
          if (!code) {
            payload.error = 'No entitlement available for audience scoping';
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p: any = prisma as any;
            const sel = await p.projectSelection
              .findUnique({ where: { customerId_entitlementCode: { customerId: user.stripeCustomerId, entitlementCode: code } } })
              .catch(() => null);
            const now = new Date();
            let current = sel?.currentProject as string | null | undefined;
            if (sel?.pendingProject && sel.pendingEffectiveAt && sel.pendingEffectiveAt <= now) {
              current = sel.pendingProject;
              try {
                await p.projectSelection.update({
                  where: { customerId_entitlementCode: { customerId: user.stripeCustomerId, entitlementCode: code } },
                  data: { currentProject: current, pendingProject: null, pendingEffectiveAt: null },
                });
              } catch {}
            }
            if (!current || current.toLowerCase() !== requestedAud) {
              payload.error = 'Audience not allowed for current period';
            }
          }
        }

        const secret = process.env.ENTITLEMENTS_JWT_SECRET;
        if (!payload.error && !secret) {
          payload.error = 'ENTITLEMENTS_JWT_SECRET not configured';
        }

        if (!payload.error && user?.stripeCustomerId && secret) {
          const now = Math.floor(Date.now() / 1000);
          const claims: Record<string, unknown> = {
            sub: userId,
            customerId: user.stripeCustomerId,
            entitlements,
            iat: now,
            exp: now + 60 * 10,
            iss: 'pixelgrimoire.com',
          };
          if (requestedAud) claims.aud = requestedAud;
          const token = signJwtHS256(claims, secret);
          payload = { token, entitlements, customerId: user.stripeCustomerId, expiresIn: 600 };
        }
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    payload.error = message;
  }

  const serialized = JSON.stringify(payload);

  return (
    <html>
      <body style={{ background: '#0b0b12', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 560, margin: '20vh auto 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Entitlements</h1>
          {payload.error ? (
            <>
              <p style={{ opacity: 0.8, marginBottom: 8 }}>No se pudo emitir el token.</p>
              <code style={{ display: 'inline-block', padding: 8, background: '#151520', borderRadius: 6 }}>{payload.error}</code>
            </>
          ) : (
            <p style={{ opacity: 0.8 }}>Enviando token a la aplicación…</p>
          )}
        </div>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var data = ${JSON.stringify(serialized)};
                try { data = JSON.parse(data); } catch {}
                var target = ${JSON.stringify(targetOrigin || '')};
                if (window.opener && target) {
                  window.opener.postMessage({ source: 'pixelgrimoire-entitlements', payload: data }, target);
                }
                setTimeout(function(){ window.close(); }, 300);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
