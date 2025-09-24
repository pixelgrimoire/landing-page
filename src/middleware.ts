import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: [
    '/',
    '/api/checkout',
    '/api/stripe/webhook',
    '/api/entitlements',
    '/api/example-pos-protected', // demo: puedes quitarlo de public si quieres forzar login
    '/sign-in(.*)',
    '/sign-up(.*)'
  ],
});

export const config = {
  matcher: [
    '/((?!.+\.[\w]+$|_next).*)',
    '/(api|trpc)(.*)'
  ],
};

