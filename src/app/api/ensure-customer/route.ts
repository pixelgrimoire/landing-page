import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureDbUserFromClerk } from '@/lib/clerkUser';
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomer';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    const primaryEmail = u.emailAddresses?.find(e=>e.id===u.primaryEmailAddressId)?.emailAddress || u.emailAddresses?.[0]?.emailAddress || undefined;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || undefined;
    const dbUser = await ensureDbUserFromClerk({ clerkUserId: userId, email: primaryEmail, name, image: u.imageUrl });
    const stripeCustomerId = await ensureStripeCustomerForUser({ userId: dbUser.id, email: primaryEmail, name, currentCustomerId: dbUser.stripeCustomerId || null });
    return new Response(JSON.stringify({ ok: true, stripeCustomerId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

