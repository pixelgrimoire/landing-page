import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Minimal round-trip to DB
    await prisma.$queryRaw`SELECT 1`;
    return new Response(JSON.stringify({ ok: true, db: 'up', time: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, db: 'down', error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

