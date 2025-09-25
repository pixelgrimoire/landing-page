import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    const tokenHash = hashToken(token);
    const claim = await prisma.claimToken.findUnique({ where: { tokenHash } });
    const now = new Date();
    if (!claim || (claim.expiresAt && claim.expiresAt < now) || claim.status === 'consumed') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }
    if (!claim.email) return NextResponse.json({ error: 'No email attached to claim' }, { status: 400 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashToken(code);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 min
    await prisma.claimOtp.create({ data: { tokenHash, otpHash, expiresAt } });

    const html = `<p>Tu código de verificación es: <b>${code}</b></p><p>Vence en 10 minutos.</p>`;
    await sendEmail(claim.email, 'Código para reclamar tu compra', html);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

