import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Auth0 from 'next-auth/providers/auth0';
import { prisma } from '@/lib/prisma';
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomer';

export const authOptions: NextAuthOptions = {
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
      // Al iniciar sesión, añade id + stripeCustomerId
      if (user) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email || '' } });
        if (dbUser) {
          token.id = dbUser.id;
          token.stripeCustomerId = dbUser.stripeCustomerId || null;
        }
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
