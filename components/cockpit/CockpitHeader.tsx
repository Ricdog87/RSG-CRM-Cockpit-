import { Button } from "@/components/ui/Button";

/** Kopfzeile des Cockpits: Begrüßung + Abmelden. */
export function CockpitHeader({ name }: { name: string }) {
  const firstName = name.split(" ")[0] || name;

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-cyan text-sm font-black text-white shadow-glow">
          RSG
        </div>
        <div>
          <p className="text-xs text-faint">Partner-Cockpit</p>
          <h1 className="text-lg font-bold text-ink">
            Hallo {firstName}
          </h1>
        </div>
      </div>
      <form action="/cockpit/auth/signout" method="post">
        <Button variant="ghost" type="submit">
          Abmelden
        </Button>
      </form>
    </header>
  );
}
