import { useMockData } from "@/lib/env";

/**
 * Layout der geschützten Route-Group. Reiner Rahmen — der eigentliche
 * Auth-Guard läuft in der Middleware (Redirect auf /cockpit/login).
 */
export default function CockpitGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      {/* Marken-Glow im Hintergrund */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-brand-glow"
      />
      {useMockData ? (
        <div className="border-b border-warning/20 bg-warning/10 px-4 py-1.5 text-center text-xs text-warning">
          Demo-Modus · Mock-Daten aktiv (keine Supabase-ENV gesetzt)
        </div>
      ) : null}
      {children}
    </div>
  );
}
