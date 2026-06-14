/** Ladezustand des Inhaltsbereichs – Shell (Sidebar/Topbar) bleibt bestehen. */
export default function CockpitLoading() {
  return (
    <div className="space-y-6">
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
    </div>
  );
}
