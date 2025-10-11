import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/checkout',
  '/claim(.*)',
  '/register(.*)',
  '/api/claim(.*)',
  '/api/health(.*)',
  '/api/stripe/webhook',
  '/api/subscribe(.*)',
  '/api/plans(.*)',
  '/api/entitlements(.*)',
  // Public featured projects (listing + HTML view + React demo)
  '/api/featured(.*)',
  '/featured(.*)',
  // Diagnostics
  '/api/whoami',
  // Note: project selection endpoints are not public; keep them protected
  '/_next/image(.*)',
  '/_next/static(.*)',
  '/demo(.*)',
  '/subscribe(.*)',
  '/sso-callback(.*)',
  '/oauth(.*)',
  '/favicon.ico',
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
    // exclude any path with a dot (static files) or _next
    '/((?!.*\\..*|_next).*)',
    '/(api|trpc)(.*)'
  ],
};
