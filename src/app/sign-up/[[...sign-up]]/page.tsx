'use client';
import { SignUp } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';
import PasswordHint from '@/components/PasswordHint';

export default function Page() {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!hasClerk) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-16 text-center text-white/80">
        <div>
          <p className="mb-2">Autenticación no configurada.</p>
          <p className="text-sm">Define NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY para habilitar el registro.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16">
      <div>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" appearance={clerkAppearance} />
        <PasswordHint />
      </div>
    </div>
  );
}
