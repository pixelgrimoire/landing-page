import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { token, otp } = (await req.json()) as { token?: string; otp?: string };
    if (!token || !otp) return NextResponse.json({ error: 'Missing token or otp' }, { status: 400 });
    const tokenHash = hashToken(token);
    const otpHash = hashToken(otp);
    const now = new Date();
    const claim = await prisma.claimToken.findUnique({ where: { tokenHash } });
    if (!claim || (claim.expiresAt && claim.expiresAt < now) || claim.status === 'consumed') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }
    const record = await prisma.claimOtp.findFirst({ where: { tokenHash }, orderBy: { createdAt: 'desc' } });
    if (!record || record.consumedAt || record.expiresAt < now) {
      return NextResponse.json({ error: 'OTP expired or missing' }, { status: 400 });
    }
    if (record.attempts >= record.maxAttempts) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }
    if (record.otpHash !== otpHash) {
      await prisma.claimOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    await prisma.claimOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    const res = NextResponse.json({ ok: true });
    // cookie temporal para permitir /register sin cookie original
    res.headers.append('Set-Cookie', `pg_claim_verified=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 15}`);
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

