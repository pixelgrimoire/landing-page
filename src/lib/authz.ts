import { auth, clerkClient } from '@clerk/nextjs/server';

export async function ensureAdmin(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' };

  let allowed = false;

  try {
    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    // read primary email if needed in the future
    const _primaryEmail = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || '';

    const pub = (u.publicMetadata || {}) as Record<string, unknown>;
    const priv = (u.privateMetadata || {}) as Record<string, unknown>;

    const pubRole = typeof pub.role === 'string' ? pub.role : '';
    const privRole = typeof priv.role === 'string' ? priv.role : '';
    const privAdmin = priv.admin === true;
    const pubRoles = Array.isArray((pub as unknown as { roles?: unknown }).roles)
      ? ((pub as unknown as { roles?: string[] }).roles || [])
      : [];

    if (pubRole === 'admin' || privRole === 'admin' || privAdmin || pubRoles.includes('admin')) allowed = true;

    const orgRole = (sessionClaims as unknown as { org_role?: string; orgRole?: string } | null) || null;
    const claimed = (orgRole?.org_role || orgRole?.orgRole || '').toLowerCase();
    if (claimed && (claimed === 'admin' || claimed === 'owner')) allowed = true;
  } catch {
    // ignore and fall back to env allowlist
  }

  // No fallback to env allowlist here to avoid drift.
  // Grant admin only via Clerk metadata or organization claims.

  return allowed ? { ok: true } : { ok: false, status: 403, error: 'Forbidden' };
}
