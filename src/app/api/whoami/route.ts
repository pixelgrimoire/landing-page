import type { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureAdmin } from '@/lib/authz';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ signedIn: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    const primaryEmail = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || '';

    const admin = await ensureAdmin();
    const pub = (u.publicMetadata || {}) as Record<string, unknown>;
    const orgRole = (sessionClaims as unknown as { org_role?: string; orgRole?: string } | null) || null;

    return new Response(JSON.stringify({
      signedIn: true,
      userId,
      email: primaryEmail,
      isAdmin: admin.ok,
      publicMetadata: pub,
      orgRole: orgRole?.org_role || orgRole?.orgRole || null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
