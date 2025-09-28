import { requireEntitlement } from '@/lib/requireEntitlement';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireEntitlement('pos.basic');
    return new Response(JSON.stringify({ ok: true, message: 'Acceso POS permitido' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const status = err?.status || 401;
    const message = err?.message || 'Unauthorized';
    return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}
