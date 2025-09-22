import { NextRequest } from 'next/server';
import { requireEntitlement } from '@/lib/requireEntitlement';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    await requireEntitlement('pos.basic');
    return new Response(JSON.stringify({ ok: true, message: 'Acceso POS permitido' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    const status = e?.status || 401;
    return new Response(JSON.stringify({ error: e?.message || 'Unauthorized' }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}

