import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

export async function requireEntitlement(code: string) {
  const session = await getServerSession(authOptions);
  const has = !!session?.entitlements?.includes(code);
  if (!has) {
    throw Object.assign(new Error('Forbidden: missing entitlement'), { status: 403 });
  }
  return session;
}

