/** Ladezustand des Cockpits – Skeletons in der finalen Sektions-Anordnung. */
export default function CockpitLoading() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
        <div className="skeleton h-10 w-24 rounded-xl" />
      </div>

      <div className="skeleton h-72 w-full rounded-2xl" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-64 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
