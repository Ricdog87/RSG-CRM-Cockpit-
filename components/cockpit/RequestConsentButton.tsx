"use client";

import { useTransition } from "react";
import { IconMail } from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import { requestConsent } from "@/lib/consent-actions";

/**
 * Kompakter Quick-Button: DSGVO-Einwilligung (Zweck VERMITTLUNG) direkt aus
 * dem Match-Kontext anfragen – ohne Umweg über das Kandidatenprofil.
 */
export function RequestConsentButton({ candidateId }: { candidateId: string }) {
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await requestConsent(candidateId);
      if (!res.ok) {
        toast.error(res.error ?? "Anfrage fehlgeschlagen.");
        return;
      }
      if (res.emailed) {
        toast.success("Einwilligungs-Anfrage per E-Mail gesendet.");
      } else if (res.link) {
        try {
          await navigator.clipboard.writeText(res.link);
          toast.success("Einwilligungs-Link kopiert – per E-Mail/WhatsApp senden.");
        } catch {
          toast.success("Einwilligungs-Link erstellt (im Profil sichtbar).");
        }
      } else {
        toast.success("Einwilligungs-Anfrage erstellt.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title="DSGVO-Einwilligung (Vermittlung) anfragen"
      className="inline-flex flex-none items-center gap-1 rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs font-semibold text-warning hover:bg-warning/15 disabled:opacity-60"
    >
      <IconMail size={12} className="flex-none" /> {pending ? "…" : "Einwilligung anfragen"}
    </button>
  );
}
