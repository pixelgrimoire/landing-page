import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/checkout',
  '/claim(.*)',
  '/register(.*)',
  '/api/claim(.*)',
  '/api/health(.*)',
  '/api/stripe/webhook',
  '/api/entitlements',
  '/_next/image(.*)',
  '/_next/static(.*)',
  '/demo(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!.+\.[\w]+$|_next).*)',
    '/(api|trpc)(.*)'
  ],
};
