import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';
import ClaimOtpForm from '@/components/claim/ClaimOtpForm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function ClaimStart({ searchParams }: { searchParams: { token?: string } }) {
  const token = (searchParams?.token || '').toString();
  if (!token) redirect('/');
  const tokenHash = hashToken(token);
  const claim = await prisma.claimToken.findUnique({ where: { tokenHash } });
  const now = new Date();
  if (!claim || (claim.expiresAt && claim.expiresAt < now) || claim.status === 'consumed') {
    redirect('/');
  }
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('pg_claim')?.value || '';
  if (cookieToken && cookieToken === token) {
    redirect(`/register?token=${encodeURIComponent(token)}`);
  }
  // enmascarar email: primera letra + dominio
  const emailMasked = claim.email ? (() => {
    const [local, domain] = claim.email!.split('@');
    if (!domain) return claim.email!;
    const first = local[0] ?? '';
    return `${first}${'*'.repeat(Math.max(0, local.length - 1))}@${domain}`;
  })() : undefined;
  return <ClaimOtpForm token={token} emailMasked={emailMasked} />;
}
