import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getAllowedOrigins(): string[] {
  const envList = process.env.ENTITLEMENTS_ALLOWED_ORIGINS || '';
  return envList
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function isAllowedTarget(target: string, requestOrigin: string): boolean {
  // Allow same-origin paths
  if (target.startsWith('/')) return true;
  try {
    const url = new URL(target);
    // Always allow redirect back to the current origin
    if (`${url.protocol}//${url.host}` === requestOrigin) return true;
    const allowed = new Set(getAllowedOrigins());
    const origin = `${url.protocol}//${url.host}`;
    if (allowed.has(origin)) return true;
    // Also allow any subdomain of the current apex domain (e.g., *.pixelgrimoire.com)
    try {
      const reqHost = new URL(requestOrigin).host;
      const parts = reqHost.split('.');
      if (parts.length >= 2) {
        const apex = parts.slice(-2).join('.');
        if (url.hostname === apex || url.hostname.endsWith(`.${apex}`)) return true;
      }
    } catch {}
    return false;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const to = u.searchParams.get('to') || '/';
  const requestOrigin = `${u.protocol}//${u.host}`;
  const safe = isAllowedTarget(to, requestOrigin);
  const destination = safe ? to : '/';
  // Use 307 to preserve method if needed
  try {
    return NextResponse.redirect(destination, { status: 307 });
  } catch {
    // If Next refuses absolute, fallback to building absolute for same-origin paths
    if (destination.startsWith('/')) {
      const abs = new URL(destination, requestOrigin).toString();
      return NextResponse.redirect(abs, { status: 307 });
    }
    return NextResponse.redirect('/', { status: 307 });
  }
}

