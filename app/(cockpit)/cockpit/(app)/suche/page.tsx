import Link from "next/link";
import { runCrmSearch, fold, type SearchHit, type SearchGroup } from "@/lib/crm-search";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight, IconSearch } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

function SearchField({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/cockpit/suche" className="relative flex items-center">
      <IconSearch size={18} className="pointer-events-none absolute left-3.5 text-faint" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus
        placeholder="Name, Firma, E-Mail, Telefon, Ort, RSG-Nr. …"
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

/** Akzent-/ss-tolerantes Hervorheben der getippten Begriffe. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!text) return null;
  if (tokens.length === 0) return <>{text}</>;
  const ft = fold(text);
  // Markiere Zeichenbereiche, die zu einem Token gehören (im gefalteten Text).
  const marks: boolean[] = new Array(text.length).fill(false);
  for (const tok of tokens) {
    if (!tok) continue;
    let from = 0;
    let idx = ft.indexOf(tok, from);
    while (idx >= 0 && idx < text.length) {
      for (let k = idx; k < Math.min(idx + tok.length, text.length); k++) marks[k] = true;
      from = idx + tok.length;
      idx = ft.indexOf(tok, from);
    }
  }
  const out: JSX.Element[] = [];
  let buf = "";
  let cur = false;
  const flush = (i: number) => {
    if (!buf) return;
    out.push(
      cur ? (
        <mark key={i} className="rounded bg-sky/25 px-0.5 text-ink">{buf}</mark>
      ) : (
        <span key={i}>{buf}</span>
      )
    );
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    if (marks[i] !== cur) {
      flush(i);
      cur = marks[i];
    }
    buf += text[i];
  }
  flush(text.length);
  return <>{out}</>;
}

const KIND_AVATAR: Record<SearchGroup["kind"], string> = {
  kunde: "bg-brand/15 text-brand-deep",
  kandidat: "bg-sky/15 text-sky-deep",
  mandat: "bg-warning/15 text-warning",
  chance: "bg-success/15 text-success",
  ki: "bg-violet-500/15 text-violet-600",
};

function initials(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const MAX_HITS = 50;

function ResultGroup({
  group,
  tokens,
}: {
  group: SearchGroup;
  tokens: string[];
}) {
  if (group.hits.length === 0) return null;
  const shown: SearchHit[] = group.hits.slice(0, MAX_HITS);
  return (
    <Card>
      <CardBody>
        <SectionHeader title={group.label} hint={`${group.hits.length} Treffer`} />
        <ul className="divide-y divide-border">
          {shown.map((h, i) => (
            <li key={i}>
              <Link
                href={h.href}
                className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[0.7rem] font-bold ${KIND_AVATAR[group.kind]}`}
                >
                  {initials(h.title) || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink group-hover:text-brand-deep">
                    <Highlight text={h.title} tokens={tokens} />
                  </p>
                  <p className="truncate text-xs text-muted">
                    <Highlight text={h.subtitle} tokens={tokens} />
                  </p>
                  {h.meta ? (
                    <p className="truncate text-[0.7rem] text-faint">
                      <Highlight text={h.meta} tokens={tokens} />
                    </p>
                  ) : null}
                </div>
                {h.badge ? (
                  <Badge tone="neutral">{h.badge}</Badge>
                ) : null}
                <IconChevronRight size={16} className="flex-none text-faint" />
              </Link>
            </li>
          ))}
        </ul>
        {group.hits.length > MAX_HITS ? (
          <p className="pt-3 text-center text-xs text-faint">
            … und {group.hits.length - MAX_HITS} weitere – Suchbegriff verfeinern.
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
        <EmptyState title="Tippe einen Begriff – Unternehmen, Kandidaten, Mandate, Chancen & KI-Projekte werden akzent- und tippfehlertolerant durchsucht (Name, E-Mail, Telefon, Ort, RSG-Nr.)." />
      </div>
    );
  }

  const { groups, total } = await runCrmSearch(q, 9999);
  const tokens = fold(q).split(/\s+/).filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suche"
        title={`Ergebnisse für „${q}“`}
        description={`${total} Treffer über Unternehmen, Kandidaten, Mandate, Chancen & KI-Projekte.`}
        action={<Badge tone="neutral">{total}</Badge>}
      />

      <SearchField defaultValue={q} />

      {total === 0 ? (
        <EmptyState title="Keine Treffer. Versuche einen anderen Begriff – z.B. Firmen-, Personen- oder Ortsname." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <ResultGroup key={g.kind} group={g} tokens={tokens} />
          ))}
        </div>
      )}
    </div>
  );
}
