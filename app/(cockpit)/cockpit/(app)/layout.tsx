import { getPartnerIdentity } from "@/lib/data";
import { useMockData } from "@/lib/env";
import { Sidebar } from "@/components/cockpit/Sidebar";
import { Topbar } from "@/components/cockpit/Topbar";
import { MobileNav } from "@/components/cockpit/MobileNav";

/**
 * App-Shell des RSG-CRM: feste Sidebar (Desktop), Topbar und Mobile-Tab-Bar.
 * Umschließt alle authentifizierten Cockpit-Seiten.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getPartnerIdentity();

  return (
    <div className="flex min-h-screen">
      <Sidebar partnerName={identity.display_name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar partnerName={identity.display_name} />

        {useMockData ? (
          <div className="border-b border-warning/20 bg-warning/10 px-4 py-1.5 text-center text-xs text-warning sm:px-6">
            Demo-Modus · Mock-Daten aktiv (keine Supabase-ENV gesetzt)
          </div>
        ) : null}

        <main className="flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
