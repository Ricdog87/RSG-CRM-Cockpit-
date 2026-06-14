/**
 * Äußere Route-Group. Reiner visueller Rahmen (Marken-Glow). Der Auth-Guard
 * läuft in der Middleware; die App-Shell sitzt in der inneren (app)-Group,
 * damit die Login-Seite ohne Shell bleibt.
 */
export default function CockpitGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-brand-glow"
      />
      {children}
    </div>
  );
}
