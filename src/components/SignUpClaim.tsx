'use client';
import { SignUp } from '@clerk/nextjs';

export default function SignUpClaim({ token }: { token: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16">
      <SignUp
        routing="path"
        path="/register"
        signInUrl="/sign-in"
        afterSignUpUrl={`/api/claim/consume?token=${encodeURIComponent(token)}`}
      />
    </div>
  );
}

