import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SignUpClaim from '@/components/SignUpClaim';
import { hashToken } from '@/lib/tokens';
import { prisma } from '@/lib/prisma';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = (params?.token || '').toString();
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('pg_claim')?.value || '';
  const verifiedToken = cookieStore.get('pg_claim_verified')?.value || '';
  if (!token || (token !== cookieToken && token !== verifiedToken)) redirect('/');
  const tokenHash = hashToken(token);
  const claim = await prisma.claimToken.findUnique({ where: { tokenHash } });
  const now = new Date();
  if (!claim || (claim.expiresAt && claim.expiresAt < now) || claim.status === 'consumed') {
    redirect('/');
  }
  // Permitimos registro
  return <SignUpClaim token={token} />;
}
