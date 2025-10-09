"use client";

import { useState } from "react";
import AdminStripeTools from "@/components/AdminStripeTools";

type Section = "plans" | "health" | "settings";

export default function AdminPanel() {
  const [section, setSection] = useState<Section>("plans");

  return (
    <div className="grid grid-cols-[220px_1fr] gap-4 min-h-[60vh]">
      <aside className="rounded-lg border border-white/10 bg-white/[.03] p-3">
        <div className="text-xs uppercase text-white/60 mb-2">Admin</div>
        <nav className="flex flex-col gap-1 text-sm">
          <button
            className={`text-left px-3 py-2 rounded-md ${section==='plans' ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
            onClick={()=>setSection('plans')}
          >Planes</button>
          <button
            className={`text-left px-3 py-2 rounded-md ${section==='health' ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
            onClick={()=>setSection('health')}
          >Salud</button>
          <button
            className={`text-left px-3 py-2 rounded-md ${section==='settings' ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
            onClick={()=>setSection('settings')}
          >Ajustes</button>
        </nav>
      </aside>
      <main className="min-h-[60vh] rounded-lg border border-white/10 bg-white/[.02] p-4">
        {section === 'plans' && (
          <AdminStripeTools />
        )}
        {section === 'health' && (
          <div className="text-white/80">
            <div className="text-lg font-semibold mb-2">Salud del sistema</div>
            <p className="text-sm text-white/60">Próximamente: chequeos de Stripe, DB y claves.</p>
          </div>
        )}
        {section === 'settings' && (
          <div className="text-white/80">
            <div className="text-lg font-semibold mb-2">Ajustes</div>
            <p className="text-sm text-white/60">Próximamente: parámetros globales (moneda por defecto, branding, etc.).</p>
          </div>
        )}
      </main>
    </div>
  );
}

