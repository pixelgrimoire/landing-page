import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL('/', req.url));

  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('pg_claim')?.value || '';
  const verifiedToken = cookieStore.get('pg_claim_verified')?.value || '';
  if (!token || (token !== cookieToken && token !== verifiedToken)) return NextResponse.redirect(new URL('/', req.url));

  const tokenHash = hashToken(token);
  const claim = await prisma.claimToken.findUnique({ where: { tokenHash } });
  if (!claim || claim.status === 'consumed') return NextResponse.redirect(new URL('/', req.url));

  // Vincular usuario a stripeCustomerId si existe en claim
  const targetUrl = new URL('/', req.url);
  if (claim.stripeCustomerId) {
    await prisma.user.upsert({
      where: { clerkUserId: userId },
      update: { stripeCustomerId: claim.stripeCustomerId },
      create: { clerkUserId: userId, stripeCustomerId: claim.stripeCustomerId, email: claim.email || undefined },
    });
    await prisma.customer.upsert({
      where: { id: claim.stripeCustomerId },
      update: { email: claim.email || undefined, userId: (await prisma.user.findFirst({ where: { clerkUserId: userId } }))?.id },
      create: { id: claim.stripeCustomerId, email: claim.email || undefined, userId: (await prisma.user.findFirst({ where: { clerkUserId: userId } }))?.id },
    });
    targetUrl.searchParams.set('onboarding', 'done');
  } else {
    targetUrl.searchParams.set('onboarding', 'pending');
  }

  await prisma.claimToken.update({ where: { tokenHash }, data: { status: 'consumed', usedAt: new Date() } });

  const res = NextResponse.redirect(targetUrl);
  // limpiar cookies de claim
  res.headers.append('Set-Cookie', 'pg_claim=; Path=/; Max-Age=0; SameSite=Lax');
  res.headers.append('Set-Cookie', 'pg_claim_verified=; Path=/; Max-Age=0; SameSite=Lax');
  return res;
}
