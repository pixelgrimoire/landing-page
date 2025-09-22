import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Auth0 from 'next-auth/providers/auth0';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomer';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 },
  trustHost: true,
  providers: [
    // Auth0 (recomendado). Se activará si hay ENV configuradas.
    ...(process.env.AUTH0_ISSUER && process.env.AUTH0_CLIENT_ID && process.env.AUTH0_CLIENT_SECRET
      ? [Auth0({
          issuer: process.env.AUTH0_ISSUER,
          clientId: process.env.AUTH0_CLIENT_ID,
          clientSecret: process.env.AUTH0_CLIENT_SECRET,
        })]
      : []),
    // Credentials (solo para desarrollo local). Desactivado en producción.
    ...((!process.env.AUTH0_ISSUER && process.env.NODE_ENV !== 'production') ? [Credentials({
      name: 'Dev Email',
      credentials: { email: { label: 'Email', type: 'email' }, name: { label: 'Name', type: 'text' } },
      async authorize(creds) {
        const email = (creds?.email || '').toString().trim().toLowerCase();
        const name = (creds?.name || '').toString().trim();
        if (!email || !email.includes('@')) return null;
        // Crea o recupera el usuario
        const user = await prisma.user.upsert({
          where: { email },
          update: { name: name || undefined },
          create: { email, name: name || undefined },
        });
        // Asegura customer en Stripe y enlaza
        await ensureStripeCustomerForUser({ userId: user.id, email: user.email, name: user.name, currentCustomerId: user.stripeCustomerId });
        return { id: user.id, email: user.email!, name: user.name || undefined, image: user.image || undefined } as any;
      },
    })] : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Al iniciar sesión, asegura usuario en BD, crea Customer si falta y añade id + stripeCustomerId
      if (user) {
        // Garantiza que el usuario exista (con adapter debería existir)
        const dbUser = await prisma.user.upsert({
          where: { email: user.email || '' },
          update: { name: user.name || undefined },
          create: { email: user.email!, name: user.name || undefined },
        });
        // Crear/adjuntar Customer en Stripe
        await ensureStripeCustomerForUser({ userId: dbUser.id, email: dbUser.email, name: dbUser.name, currentCustomerId: dbUser.stripeCustomerId });
        const refreshed = await prisma.user.findUnique({ where: { id: dbUser.id } });
        token.id = refreshed?.id;
        token.stripeCustomerId = refreshed?.stripeCustomerId || null;
      }
      // En cada paso, si tenemos customer, adjunta entitlements
      if (token.stripeCustomerId) {
        const ents = await prisma.entitlement.findMany({ where: { customerId: token.stripeCustomerId, status: { not: 'inactive' } } });
        token.entitlements = ents.map(e => e.code);
      } else {
        token.entitlements = [];
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || ({} as any);
      (session.user as any).id = (token as any).id;
      (session.user as any).stripeCustomerId = (token as any).stripeCustomerId || null;
      (session as any).entitlements = (token as any).entitlements || [];
      return session;
    },
  },
  // Define un secret para producción
  secret: process.env.NEXTAUTH_SECRET,
};
