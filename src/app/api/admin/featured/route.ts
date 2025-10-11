import type { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function ensureAdmin() {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, status: 401, error: 'Unauthorized' };
  const clerk = await clerkClient();
  const u = await clerk.users.getUser(userId);
  const email = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || '';
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes((email || '').toLowerCase())) return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const };
}

export async function GET() {
  const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
  const rows = await prisma.featuredProject.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return new Response(JSON.stringify({ items: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  try {
    const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
    const body = await req.json().catch(()=>({}));
    const { id, title, subtitle, summary, html, thumbnailUrl, thumbnailHtml, kind, contentUrl, componentKey, active } = body as { id?: string; title?: string; subtitle?: string | null; summary?: string | null; html?: string; thumbnailUrl?: string | null; thumbnailHtml?: string | null; kind?: string; contentUrl?: string | null; componentKey?: string | null; active?: boolean };
    let { slug, sortOrder } = body as { slug?: string; sortOrder?: number };
    const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug && title) slug = slugify(String(title));
    if (!slug || !title) return new Response(JSON.stringify({ error: 'Missing slug or title' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (typeof sortOrder !== 'number') {
      const max = await prisma.featuredProject.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
      sortOrder = ((max?.sortOrder ?? 0) + 10);
    }
    const allowedKinds = new Set(['html','iframe','image','video','pdf','react']);
    const k = (kind || 'html').toLowerCase();
    const finalKind = allowedKinds.has(k) ? k : 'html';
    const data = {
      slug: slugify(String(slug)),
      title: String(title).trim(),
      subtitle: subtitle ?? null,
      summary: summary ?? null,
      html: html || '',
      thumbnailUrl: thumbnailUrl ?? null,
      thumbnailHtml: thumbnailHtml ?? null,
      kind: finalKind,
      contentUrl: contentUrl ?? null,
      componentKey: componentKey ?? null,
      active: typeof active === 'boolean' ? active : true,
      sortOrder: Number(sortOrder),
    };
    const row = await prisma.featuredProject.upsert({ where: { slug: data.slug }, update: data, create: data });
    return new Response(JSON.stringify({ ok: true, item: row }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function DELETE(req: NextRequest) {
  const adm = await ensureAdmin(); if (!adm.ok) return new Response(JSON.stringify({ error: adm.error }), { status: adm.status, headers: { 'Content-Type': 'application/json' } });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  await prisma.featuredProject.delete({ where: { id } }).catch(()=>undefined);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
