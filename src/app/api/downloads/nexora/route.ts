import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find the user's Stripe customer
  const user = await prisma.user.findFirst({ where: { clerkUserId: userId } });
  if (!user?.stripeCustomerId) {
    return new Response(JSON.stringify({ error: 'No subscription found' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check for an active nexora.* entitlement
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      customerId: user.stripeCustomerId,
      code: { startsWith: 'nexora.' },
      status: { in: ['active', 'trialing'] },
    },
  });

  if (!entitlement) {
    return new Response(JSON.stringify({ error: 'No active Nexora entitlement' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch latest GitHub release for the installer
  try {
    const res = await fetch(
      'https://api.github.com/repos/GrappePie/nexora/releases/latest',
      {
        headers: { 'User-Agent': 'pixelgrimoire-landing', Accept: 'application/vnd.github.v3+json' },
        next: { revalidate: 3600 },
      },
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Release not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const release = await res.json() as {
      tag_name: string;
      published_at: string;
      html_url: string;
      assets: Array<{ name: string; browser_download_url: string; size: number }>;
    };

    const asset = release.assets?.find(a => a.name.endsWith('.exe'));

    return new Response(
      JSON.stringify({
        version: release.tag_name,
        downloadUrl: asset?.browser_download_url ?? null,
        fileName: asset?.name ?? null,
        fileSizeMb: asset ? Math.round(asset.size / (1024 * 1024) * 10) / 10 : null,
        publishedAt: release.published_at,
        releaseUrl: release.html_url,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch release info' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
}
