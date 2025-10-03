"use client";

import { UserProfile } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';
import SubscriptionManager from '@/components/SubscriptionManager';

export default function AccountPage() {
  return (
    <div className="pg-bg min-h-screen text-white px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <UserProfile path="/account" routing="path" appearance={clerkAppearance}>
          {/* Página personalizada dentro del gestor de perfil */}
          <UserProfile.Page
            label="Suscripción"
            url="subscription"
            labelIcon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg>}
          >
            <div className="p-4">
              <SubscriptionManager />
            </div>
          </UserProfile.Page>
        </UserProfile>
      </div>
    </div>
  );
}
