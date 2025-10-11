import { prisma } from '@/lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';

export async function ensureDbUserFromClerk(params: {
  clerkUserId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}) {
  const ensureDefaultRole = async () => {
    try {
      const clerk = await clerkClient();
      const u = await clerk.users.getUser(params.clerkUserId);
      const pub = (u.publicMetadata || {}) as Record<string, unknown>;
      const role = typeof pub.role === 'string' ? pub.role : '';
      if (!role) {
        await clerk.users.updateUser(params.clerkUserId, { publicMetadata: { ...pub, role: 'user' } });
      }
    } catch {}
  };
  const email = params.email?.toLowerCase().trim() || undefined;
  // prefer match by clerkUserId, then by email (unique)
  const existingByClerk = await prisma.user.findFirst({ where: { clerkUserId: params.clerkUserId } });
  if (existingByClerk) {
    if (email || params.name || params.image) {
      await prisma.user.update({
        where: { id: existingByClerk.id },
        data: { email, name: params.name || undefined, image: params.image || undefined },
      }).catch(()=>undefined);
    }
    await ensureDefaultRole();
    return existingByClerk;
  }
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } }).catch(()=>null);
    if (byEmail) {
      const updated = await prisma.user.update({
        where: { id: byEmail.id },
        data: { clerkUserId: params.clerkUserId, name: params.name || undefined, image: params.image || undefined },
      });
      await ensureDefaultRole();
      return updated;
    }
  }
  // create fresh
  const created = await prisma.user.create({
    data: { clerkUserId: params.clerkUserId, email, name: params.name || undefined, image: params.image || undefined },
  });
  // Best-effort: ensure a default Clerk publicMetadata.role = 'user'
  await ensureDefaultRole();
  return created;
}
