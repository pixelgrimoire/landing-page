'use client';
import { SignUp } from '@clerk/nextjs';
import PasswordHint from '@/components/PasswordHint';
import { clerkAppearance } from '@/lib/clerkAppearance';

export default function SignUpClaim({ token }: { token: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16">
      <div>
        <SignUp
          routing="path"
          path="/register"
          signInUrl="/sign-in"
          afterSignUpUrl={`/api/claim/consume?token=${encodeURIComponent(token)}`}
          appearance={clerkAppearance}
        />
        <PasswordHint />
      </div>
    </div>
  );
}
