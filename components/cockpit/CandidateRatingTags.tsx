"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCandidateRating, setCandidateTags } from "@/lib/crm-actions";
import { IconClose } from "@/components/ui/icons";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "#f59e0b" : "none"}
      stroke={filled ? "#f59e0b" : "#94a3b8"}
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

/** Sterne-Bewertung (0–5) + freie Tags je Kandidat:in. */
export function CandidateRatingTags({
  id,
  rating,
  tags,
}: {
  id: string;
  rating: number;
  tags: string[];
}) {
  const router = useRouter();
  const [r, setR] = useState(rating);
  const [hover, setHover] = useState(0);
  const [list, setList] = useState<string[]>(tags);
  const [input, setInput] = useState("");
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function rate(v: number) {
    const next = v === r ? 0 : v; // erneuter Klick auf denselben Wert = zurücksetzen
    setR(next);
    setError(null);
    start(async () => {
      const res = await setCandidateRating(id, next);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) setError(res.error ?? "Fehler.");
    });
  }

  function commitTags(next: string[]) {
    setList(next);
    setError(null);
    start(async () => {
      const res = await setCandidateTags(id, next);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) setError(res.error ?? "Fehler.");
    });
  }

  function addTag() {
    const t = input.trim();
    setInput("");
    if (!t || list.includes(t)) return;
    commitTags([...list, t]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            aria-label={`${v} Sterne`}
            onClick={() => rate(v)}
            onMouseEnter={() => setHover(v)}
            className="p-0.5"
          >
            <Star filled={(hover || r) >= v} />
          </button>
        ))}
        {r > 0 ? <span className="ml-1.5 text-xs text-faint">{r}/5</span> : null}
      </div>

      {list.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {list.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5 text-xs text-ink"
            >
              {t}
              <button
                type="button"
                aria-label="Tag entfernen"
                onClick={() => commitTags(list.filter((x) => x !== t))}
                className="text-faint hover:text-danger"
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        }}
        placeholder="Tag hinzufügen + Enter"
        className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
