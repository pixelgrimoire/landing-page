import type { NextRequest } from 'next/server';
// Removed unused Clerk imports
import { ensureAdmin as requireAdmin } from '@/lib/authz';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

const ensureAdmin = requireAdmin;

export async function POST(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
    const form = await req.formData();
    const file = form.get('file') as unknown as File | null;
    const slugRaw = form.get('slug');
    const slug = (typeof slugRaw === 'string' ? slugRaw : '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '');
    if (!file || !slug) return new Response(JSON.stringify({ error: 'Missing file or slug' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const f = file as File;
    const type = f.type as string | undefined;
    if (!type || !type.startsWith('image/')) return new Response(JSON.stringify({ error: 'Only image files are allowed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const size = f.size as number | undefined;
    if (size && size > 5 * 1024 * 1024) return new Response(JSON.stringify({ error: 'Max 5MB' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const name = f.name as string | undefined;
    const extFromName = name && name.includes('.') ? name.split('.').pop()!.toLowerCase() : (type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'bin');
    const key = `featured/${slug}-${Date.now()}.${extFromName}`;

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await put(key, file as unknown as Blob, { access: 'public', token: token || undefined, contentType: type });
    return new Response(JSON.stringify({ ok: true, url: res.url, pathname: res.pathname }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
