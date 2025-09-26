'use client';
import { SignIn } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';

export default function Page() {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!hasClerk) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-16 text-center text-white/80">
        <div>
          <p className="mb-2">Autenticación no configurada.</p>
          <p className="text-sm">Define NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY para habilitar el login.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" appearance={clerkAppearance} />
    </div>
  );
}
