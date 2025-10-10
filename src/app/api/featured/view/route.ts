import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get('slug') || '').trim();
    if (!slug) return new Response('Missing slug', { status: 400 });
    const item = await prisma.featuredProject.findUnique({ where: { slug } });
    if (!item || !item.active) return new Response('Not found', { status: 404 });
    return new Response(item.html || '', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (e: unknown) {
    return new Response('Error', { status: 500 });
  }
}

