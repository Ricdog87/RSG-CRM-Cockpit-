"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_GROUPS } from "@/lib/nav";
import type { SearchGroup } from "@/lib/crm-search";

interface FlatItem {
  href: string;
  title: string;
  subtitle: string;
  group: string;
}

const NAV_ITEMS: FlatItem[] = NAV_GROUPS.flatMap((g) =>
  g.items.map((it) => ({
    href: it.href,
    title: it.label,
    subtitle: it.description,
    group: "Navigation",
  }))
);

/** Schnell-Aktionen: öffnen direkt den jeweiligen Anlegen-Dialog (?new=1). */
const ACTION_ITEMS: FlatItem[] = [
  { href: "/cockpit/kandidaten?new=1", title: "Neue:r Kandidat:in", subtitle: "Person zur Datenbank", group: "Aktionen" },
  { href: "/cockpit/match", title: "Search & Match", subtitle: "Projekt → passende Kandidaten", group: "Aktionen" },
  { href: "/cockpit/einwilligungen", title: "Einwilligungen", subtitle: "DSGVO-Status & Anfragen", group: "Aktionen" },
  { href: "/cockpit/kalender?new=1", title: "Neuer Termin", subtitle: "Kalender-Eintrag", group: "Aktionen" },
];

/** Event-Name, mit dem andere Komponenten (z. B. Topbar) die Palette öffnen. */
export const OPEN_PALETTE_EVENT = "rsg:open-command-palette";

/**
 * Globale Befehls-Palette (⌘K / Strg+K): Schnell zu jeder Seite springen
 * oder Kunden, Kandidaten, Mandate, Chancen & KI-Projekte direkt öffnen.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroups([]);
    setActive(0);
  }, []);

  // Öffnen via Tastenkürzel + Custom-Event.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Fokus beim Öffnen.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Debounced CRM-Suche (ab 2 Zeichen).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm-search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { groups: SearchGroup[] };
        setGroups(data.groups?.filter((g) => g.hits.length > 0) ?? []);
      } catch {
        /* abgebrochen oder Fehler – stillschweigend ignorieren */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  // Flache, navigierbare Liste: gefilterte Navigation + CRM-Treffer.
  const flat = useMemo<FlatItem[]>(() => {
    const q = query.trim().toLowerCase();
    const filt = (items: FlatItem[]) =>
      items.filter(
        (n) => n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q)
      );
    const actions = q ? filt(ACTION_ITEMS) : ACTION_ITEMS;
    const nav = q ? filt(NAV_ITEMS) : NAV_ITEMS;
    const hits: FlatItem[] = groups.flatMap((g) =>
      g.hits.map((h) => ({ href: h.href, title: h.title, subtitle: h.subtitle, group: g.label }))
    );
    // Leere Suche: Aktionen + Navigation. Mit Suche: Aktionen, Nav (max 4), Treffer.
    return q ? [...actions, ...nav.slice(0, 4), ...hits] : [...actions, ...nav];
  }, [query, groups]);

  useEffect(() => setActive(0), [flat.length]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (item) go(item.href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  // Gruppierte Darstellung in Reihenfolge der flachen Liste.
  let runningIndex = -1;
  const rendered: { group: string; items: { item: FlatItem; index: number }[] }[] = [];
  for (const item of flat) {
    runningIndex += 1;
    const last = rendered[rendered.length - 1];
    if (last && last.group === item.group) {
      last.items.push({ item, index: runningIndex });
    } else {
      rendered.push({ group: item.group, items: [{ item, index: runningIndex }] });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Befehls-Palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <span className="text-faint" aria-hidden>
            ⌘K
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Springe zu… oder suche Kunden, Kandidaten, Mandate"
            aria-label="Befehl oder Suchbegriff"
            className="w-full bg-transparent py-3.5 text-base text-ink placeholder:text-faint focus:outline-none"
          />
          {loading ? <span className="text-xs text-faint">…</span> : null}
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-faint">
              {query.trim().length < 2
                ? "Tippe, um zu suchen …"
                : "Keine Treffer. Anderen Begriff versuchen."}
            </p>
          ) : (
            rendered.map((section) => (
              <div key={section.group} className="px-2 py-1">
                <p className="px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-wider text-faint">
                  {section.group}
                </p>
                <ul>
                  {section.items.map(({ item, index }) => (
                    <li key={`${item.href}-${index}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(item.href)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left ${
                          index === active ? "bg-elevated" : "hover:bg-elevated/60"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {item.title}
                          </span>
                          <span className="block truncate text-xs text-muted">{item.subtitle}</span>
                        </span>
                        {index === active ? (
                          <span className="flex-none text-[0.62rem] text-faint" aria-hidden>
                            ↵
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[0.62rem] text-faint">
          <span>↑↓ navigieren</span>
          <span>↵ öffnen</span>
          <span>Esc schließen</span>
        </div>
      </div>
    </div>
  );
}
