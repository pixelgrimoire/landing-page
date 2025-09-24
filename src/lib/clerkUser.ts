import { prisma } from '@/lib/prisma';

export async function ensureDbUserFromClerk(params: {
  clerkUserId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}) {
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
    return existingByClerk;
  }
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } }).catch(()=>null);
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { clerkUserId: params.clerkUserId, name: params.name || undefined, image: params.image || undefined },
      });
    }
  }
  // create fresh
  return prisma.user.create({
    data: { clerkUserId: params.clerkUserId, email, name: params.name || undefined, image: params.image || undefined },
  });
}

