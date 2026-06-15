"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconMail, IconCheck, IconCopy } from "@/components/ui/icons";
import { requestConsent } from "@/lib/consent-actions";

type Status = "none" | "pending" | "granted" | "revoked";

function fmt(ts?: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return ts;
  }
}

/** DSGVO-Einwilligung im Kandidatenprofil: Status + Anfrage per E-Mail. */
export function CandidateConsent({
  candidateId,
  hasEmail,
  status,
  sentAt,
  grantedAt,
}: {
  candidateId: string;
  hasEmail: boolean;
  status: Status;
  sentAt?: string | null;
  grantedAt?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function request() {
    setErr(null);
    setMsg(null);
    setLink(null);
    start(async () => {
      const r = await requestConsent(candidateId);
      if (!r.ok) {
        setErr(r.error ?? "Fehler.");
        return;
      }
      setLink(r.link ?? null);
      setMsg(r.emailed ? "E-Mail an die Kandidat:in verschickt." : "Link erstellt (E-Mail-Versand nicht konfiguriert – Link unten kopieren).");
      router.refresh();
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const badge =
    status === "granted" ? (
      <Badge tone="success">Erteilt{grantedAt ? ` · ${fmt(grantedAt)}` : ""}</Badge>
    ) : status === "pending" ? (
      <Badge tone="sky">Angefragt{sentAt ? ` · ${fmt(sentAt)}` : ""}</Badge>
    ) : status === "revoked" ? (
      <Badge tone="danger">Widerrufen</Badge>
    ) : (
      <Badge tone="neutral">Keine Einwilligung</Badge>
    );

  const label =
    status === "granted" ? "Erneut anfordern" : status === "pending" ? "Erinnerung senden" : "Einwilligung anfordern";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-faint">Status</span>
        {badge}
      </div>

      {status === "granted" ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <IconCheck size={13} /> DSGVO-konform dokumentiert{grantedAt ? ` am ${fmt(grantedAt)}` : ""}.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Holt die Einwilligung zur Datenverarbeitung (Art. 6 Abs. 1 lit. a DSGVO) per E-Mail ein.
        </p>
      )}

      <button
        type="button"
        onClick={request}
        disabled={pending || !hasEmail}
        title={hasEmail ? undefined : "Keine E-Mail-Adresse hinterlegt"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
      >
        <IconMail size={13} /> {pending ? "sende …" : label}
      </button>

      {!hasEmail ? (
        <p className="text-xs text-faint">Bitte zuerst eine E-Mail-Adresse hinterlegen.</p>
      ) : null}
      {msg ? <p className="text-xs text-success">{msg}</p> : null}
      {err ? <p className="text-xs text-danger">{err}</p> : null}
      {link ? (
        <button
          type="button"
          onClick={copy}
          className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-left text-[0.7rem] text-muted hover:border-brand/40"
        >
          <IconCopy size={12} /> {copied ? "Kopiert!" : "Einwilligungs-Link kopieren"}
        </button>
      ) : null}
    </div>
  );
}
