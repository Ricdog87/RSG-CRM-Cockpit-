"use client";

import { useTransition } from "react";
import { IconFolder } from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import { anonymizeCandidate } from "@/lib/anonymize";
import { downloadBase64Docx } from "@/lib/download";

/**
 * Kompakter „Blindprofil"-Button (z.B. in der Match-Pipeline): erzeugt das
 * anonymisierte RSG-Kurzprofil (.docx) aus dem CV und lädt es herunter.
 * Das Consent-Gate greift serverseitig in anonymizeCandidate().
 */
export function BlindProfileButton({ candidateId }: { candidateId: string }) {
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await anonymizeCandidate(candidateId);
      if (!res.ok || !res.base64) {
        toast.error(res.error ?? "Blindprofil fehlgeschlagen.");
        return;
      }
      downloadBase64Docx(res.filename ?? "RSG-Kurzprofil.docx", res.base64);
      toast.success("Blindprofil erstellt.");
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title="Blindprofil (.docx) für die Vorstellung erzeugen"
      className="inline-flex flex-none items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-ink hover:bg-elevated disabled:opacity-60"
    >
      <IconFolder size={13} className="flex-none" /> {pending ? "…" : "Blindprofil"}
    </button>
  );
}
