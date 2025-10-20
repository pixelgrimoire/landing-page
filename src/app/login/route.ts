import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = new URL(`/sign-in${url.search}`, url.origin);
  return NextResponse.redirect(target, { status: 307 });
}

