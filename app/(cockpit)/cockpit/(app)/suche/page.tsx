import Link from "next/link";
import { runCrmSearch, type SearchHit } from "@/lib/crm-search";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight, IconSearch } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

/** Suchfeld direkt auf der Suchseite – funktioniert auf allen Geräten (auch Mobile). */
function SearchField({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/cockpit/suche" className="relative flex items-center">
      <IconSearch size={18} className="pointer-events-none absolute left-3.5 text-faint" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus
        placeholder="Name, Firma, Position…"
        aria-label="Suchbegriff"
        className="w-full rounded-2xl border border-border bg-elevated/60 py-3 pl-11 pr-24 text-base text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-sky"
      />
      <button
        type="submit"
        className="absolute right-2 rounded-xl bg-gradient-to-r from-brand to-sky px-4 py-1.5 text-sm font-semibold text-white shadow-glow active:scale-95"
      >
        Suchen
      </button>
    </form>
  );
}

const MAX_HITS = 50;

function ResultGroup({ label, hits }: { label: string; hits: SearchHit[] }) {
  if (hits.length === 0) return null;
  const shown = hits.slice(0, MAX_HITS);
  return (
    <Card>
      <CardBody>
        <SectionHeader title={label} hint={`${hits.length} Treffer`} />
        <ul className="divide-y divide-border">
          {shown.map((h, i) => (
            <li key={i}>
              <Link
                href={h.href}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{h.title}</p>
                  <p className="truncate text-xs text-muted">{h.subtitle}</p>
                </div>
                <IconChevronRight size={16} className="flex-none text-faint" />
              </Link>
            </li>
          ))}
        </ul>
        {hits.length > MAX_HITS ? (
          <p className="pt-3 text-center text-xs text-faint">
            … und {hits.length - MAX_HITS} weitere – Suchbegriff verfeinern.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

export default async function SuchePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();

  if (!q) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Suche" title="CRM-Suche" />
        <SearchField />
        <EmptyState title="Gib einen Suchbegriff ein – Kunden, Chancen, Kandidaten und Mandate werden durchsucht." />
      </div>
    );
  }

  // Großzügiges Limit – die Seite zeigt selbst „und N weitere".
  const { groups, total } = await runCrmSearch(q, 9999);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suche"
        title={`Ergebnisse für „${q}"`}
        description={`${total} Treffer über Kunden, Chancen, Kandidaten und Mandate.`}
        action={<Badge tone="neutral">{total}</Badge>}
      />

      <SearchField defaultValue={q} />

      {total === 0 ? (
        <EmptyState title="Keine Treffer. Versuche einen anderen Begriff – z.B. einen Firmen- oder Personennamen." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <ResultGroup key={g.kind} label={g.label} hits={g.hits} />
          ))}
        </div>
      )}
    </div>
  );
}
