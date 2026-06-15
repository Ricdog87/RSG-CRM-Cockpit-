import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface/60 text-3xl">
        🔍
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-ink">Seite nicht gefunden</h1>
        <p className="max-w-sm text-sm text-muted">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
      </div>
      <Link
        href="/cockpit"
        className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
      >
        Zur Übersicht
      </Link>
    </main>
  );
}
