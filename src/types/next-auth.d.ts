import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      stripeCustomerId?: string | null;
    };
    entitlements?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    stripeCustomerId?: string | null;
    entitlements?: string[];
  }
}

