"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconSpark } from "@/components/ui/icons";
import { extractCandidateSkills } from "@/lib/cv-actions";

/**
 * Skill-Set einer:s Kandidat:in als Tag-Liste. Ist noch nichts hinterlegt und
 * ein PDF-CV vorhanden, lässt sich das Set per Klick aus dem CV extrahieren.
 */
export function CandidateSkills({
  id,
  skills,
  canExtract,
}: {
  id: string;
  skills: string[];
  canExtract: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<string[]>(skills);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function extract() {
    setError(null);
    start(async () => {
      const res = await extractCandidateSkills(id);
      if (res.ok) {
        if (res.skills) setLocal(res.skills);
        router.refresh();
      } else {
        setError(res.error ?? "Extraktion fehlgeschlagen.");
      }
    });
  }

  const ExtractButton = canExtract ? (
    <button
      type="button"
      onClick={extract}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
    >
      <IconSpark size={13} />
      {pending ? "extrahiere …" : local.length ? "neu aus CV" : "Skills aus CV extrahieren"}
    </button>
  ) : null;

  return (
    <div className="space-y-3">
      {local.length ? (
        <div className="flex flex-wrap gap-1.5">
          {local.map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full border border-border bg-elevated px-2.5 py-1 text-xs font-medium text-ink"
            >
              {s}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {canExtract
            ? "Noch keine Skills hinterlegt – aus dem CV extrahieren."
            : "Noch keine Skills hinterlegt (CV als PDF + KI nötig)."}
        </p>
      )}

      <div className="flex items-center gap-2">
        {ExtractButton}
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    </div>
  );
}
