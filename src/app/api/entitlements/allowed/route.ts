import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const rows = await prisma.planConfig.findMany({ select: { entitlementsJson: true, entitlementProjectsJson: true } });
    const map: Record<string, string[]> = {};
    for (const r of rows) {
      let ents: string[] = [];
      try { ents = r.entitlementsJson ? (JSON.parse(r.entitlementsJson) as string[]) : []; } catch {}
      let proj: Record<string, string[]> = {};
      try { proj = r.entitlementProjectsJson ? (JSON.parse(r.entitlementProjectsJson) as Record<string, string[]>) : {}; } catch {}
      for (const code of ents) {
        if (proj[code] && Array.isArray(proj[code]) && proj[code].length) {
          map[code] = Array.from(new Set([...(map[code] || []), ...proj[code]]));
        }
      }
    }
    return new Response(JSON.stringify({ map }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

