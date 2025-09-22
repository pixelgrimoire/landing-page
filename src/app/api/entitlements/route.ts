import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  if (!customerId) {
    return new Response(JSON.stringify({ error: 'Missing customerId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const ents = await prisma.entitlement.findMany({ where: { customerId, status: { not: 'inactive' } }, orderBy: { code: 'asc' } });
  return new Response(JSON.stringify({ entitlements: ents.map(e => e.code) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

