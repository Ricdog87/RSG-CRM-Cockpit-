"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconFolder } from "@/components/ui/icons";
import { anonymizeCandidate } from "@/lib/anonymize";
import { downloadBase64Docx } from "@/lib/download";

/** Erzeugt ein anonymisiertes RSG-Kurzprofil (.docx) aus dem CV und lädt es herunter. */
export function AnonymizeButton({ candidateId }: { candidateId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await anonymizeCandidate(candidateId);
      if (!res.ok || !res.base64) {
        setError(res.error ?? "Erstellung fehlgeschlagen.");
        return;
      }
      downloadBase64Docx(res.filename ?? "RSG-Kurzprofil.docx", res.base64);
    });
  }

  return (
    <div>
      <Button variant="subtle" onClick={run} disabled={pending} type="button">
        <IconFolder size={15} /> {pending ? "erstellt …" : "Profil anonymisieren"}
      </Button>
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
