"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconAlertTriangle, IconFolder, IconTrash } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { toast } from "@/lib/toast";
import { exportCandidateData, eraseCandidate } from "@/lib/dsgvo/subject-rights";

const PURPOSE_LABEL: Record<string, string> = {
  PROFIL_SPEICHERN: "Profil speichern",
  VERMITTLUNG: "Vermittlung",
  WEITERGABE_AN_KUNDE: "Weitergabe an Kunden",
};
const STATE_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  ERTEILT: "success",
  WIDERRUFEN: "danger",
  ABGELAUFEN: "warning",
  KEINE: "neutral",
};
const STATE_LABEL: Record<string, string> = {
  ERTEILT: "Erteilt",
  WIDERRUFEN: "Widerrufen",
  ABGELAUFEN: "Abgelaufen",
  KEINE: "Keine",
};

/** Betroffenenrechte (Art. 15/17) + Consent-Zweck-Überblick im Kandidatenprofil. */
export function CandidateDsgvo({
  candidateId,
  consentSummary,
}: {
  candidateId: string;
  consentSummary: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmErase, setConfirmErase] = useState(false);

  function doExport() {
    start(async () => {
      const res = await exportCandidateData(candidateId);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Export fehlgeschlagen.");
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsgvo-auskunft-${candidateId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Auskunft (Art. 15) exportiert.");
    });
  }

  function doErase(mode: "anonymize" | "delete") {
    start(async () => {
      const res = await eraseCandidate(candidateId, mode);
      setConfirmErase(false);
      if (!res.ok) {
        toast.error(res.error ?? "Löschung fehlgeschlagen.");
        return;
      }
      toast.success(mode === "delete" ? "Kandidat gelöscht." : "Kandidat anonymisiert.");
      if (mode === "delete") router.push("/cockpit/kandidaten");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Consent-Zweck-Überblick */}
      <div className="space-y-1.5">
        {(["PROFIL_SPEICHERN", "VERMITTLUNG", "WEITERGABE_AN_KUNDE"] as const).map((p) => {
          const state = consentSummary[p] ?? "KEINE";
          return (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{PURPOSE_LABEL[p]}</span>
              <Badge tone={STATE_TONE[state] ?? "neutral"} size="sm">
                {STATE_LABEL[state] ?? state}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Betroffenenrechte */}
      <div className="space-y-2 border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={doExport}
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-elevated disabled:opacity-60"
        >
          <IconFolder size={14} /> Auskunft exportieren (Art. 15)
        </button>

        {confirmErase ? (
          <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/[0.05] p-2.5">
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <IconAlertTriangle size={13} className="flex-none" /> Unwiderruflich. Wähle eine Option:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => doErase("anonymize")}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning hover:bg-warning/15 disabled:opacity-60"
              >
                Anonymisieren
              </button>
              <button
                type="button"
                onClick={() => doErase("delete")}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/15 disabled:opacity-60"
              >
                <IconTrash size={13} /> Endgültig löschen
              </button>
              <button
                type="button"
                onClick={() => setConfirmErase(false)}
                className="rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-ink"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            className={cn(
              "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-danger/30 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
            )}
          >
            <IconTrash size={14} /> Löschen / Anonymisieren (Art. 17)
          </button>
        )}
      </div>
    </div>
  );
}
