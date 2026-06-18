"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestAiCall } from "@/lib/fonio-actions";
import { IconPhone } from "@/components/ui/icons";

/**
 * Loest per Klick einen KI-Anruf (Fonio Outbound) an die:den Kandidat:in aus.
 * Nummer kommt aus candidate.phone; ohne Nummer ist der Button deaktiviert.
 */
export function AiCallButton({
  candidateId,
  phone,
}: {
  candidateId: string;
  phone?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function trigger() {
    if (!phone || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await requestAiCall({ candidateId, toPhone: phone });
    setBusy(false);
    setOk(res.ok);
    setMsg(res.ok ? "KI-Anruf ausgeloest." : res.error ?? "Fehler beim Ausloesen.");
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={trigger}
        disabled={busy || !phone}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-50"
      >
        <IconPhone size={14} /> {busy ? "wird ausgeloest ..." : "Per KI anrufen lassen"}
      </button>
      {!phone ? (
        <p className="text-[0.7rem] text-faint">Keine Telefonnummer hinterlegt.</p>
      ) : null}
      {msg ? (
        <p className={ok ? "text-[0.7rem] text-brand-deep" : "text-xs text-danger"}>{msg}</p>
      ) : null}
    </div>
  );
}
