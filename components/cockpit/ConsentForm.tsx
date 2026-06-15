"use client";

import { useState, useTransition } from "react";

import { grantConsent, revokeConsent } from "@/lib/consent-actions";

type Status = "pending" | "granted" | "revoked" | "expired";

function fmt(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

/** Öffentliches Einwilligungs-Formular (Kandidat:in, ohne Login). */
export function ConsentForm({
  token,
  initialStatus,
  grantedAt,
  expired,
}: {
  token: string;
  initialStatus: Status;
  grantedAt: string | null;
  expired: boolean;
}) {
  const [status, setStatus] = useState<Status>(expired ? "expired" : initialStatus);
  const [ts, setTs] = useState<string | null>(grantedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function doGrant() {
    setError(null);
    start(async () => {
      const r = await grantConsent(token);
      if (r.ok) {
        setStatus("granted");
        setTs(r.granted_at ?? new Date().toISOString());
      } else setError(r.error ?? "Fehler.");
    });
  }
  function doRevoke() {
    setError(null);
    start(async () => {
      const r = await revokeConsent(token);
      if (r.ok) {
        setStatus("revoked");
        setTs(null);
      } else setError(r.error ?? "Fehler.");
    });
  }

  if (status === "expired") {
    return (
      <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        Dieser Link ist abgelaufen. Bitte fordern Sie bei Ihrem Ansprechpartner einen neuen Link an.
      </p>
    );
  }

  if (status === "granted") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <p className="font-semibold">Vielen Dank – Ihre Einwilligung wurde erteilt.</p>
          {ts ? <p className="mt-1 text-success/90">Bestätigt am {fmt(ts)}</p> : null}
        </div>
        <p className="text-xs text-muted">
          Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.
        </p>
        <button
          type="button"
          onClick={doRevoke}
          disabled={pending}
          className="text-xs font-semibold text-danger underline hover:no-underline disabled:opacity-60"
        >
          {pending ? "…" : "Einwilligung widerrufen"}
        </button>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  if (status === "revoked") {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted">
          Ihre Einwilligung wurde widerrufen. Sie können sie unten erneut erteilen.
        </p>
        <button
          type="button"
          onClick={doGrant}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-xl bg-brand-deep px-6 py-3 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-60"
        >
          {pending ? "Wird gespeichert …" : "Einwilligung erteilen"}
        </button>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={doGrant}
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-brand-deep px-6 py-3.5 text-sm font-bold text-white shadow-glow transition-colors hover:bg-brand-ink disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Wird gespeichert …" : "Einwilligung erteilen"}
      </button>
      <p className="text-xs text-muted">
        Mit dem Klick bestätigen Sie Ihre Einwilligung. Zeitpunkt und technische Angaben werden zu
        Nachweiszwecken protokolliert.
      </p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
