"use client";

import { useState, useTransition } from "react";
import { IconSpark, IconCheck, IconMail } from "@/components/ui/icons";
import { anonymizeJobPosting, ensureShareToken } from "@/lib/job-posting";

type ShareMode = "anonym" | "original";

export function JobPostingCard({
  mandateId,
  role,
  jobPosting,
  anonymized,
  shareToken,
}: {
  mandateId: string;
  role: string;
  jobPosting?: string;
  anonymized?: string;
  shareToken?: string;
}) {
  const [pending, start] = useTransition();
  const [anonText, setAnonText] = useState<string | undefined>(anonymized);
  const [token, setToken] = useState<string | undefined>(shareToken);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<ShareMode | null>(null);
  const [askShare, setAskShare] = useState(false);

  function runAnonymize() {
    setError(null);
    start(async () => {
      const res = await anonymizeJobPosting(mandateId);
      if (!res.ok) {
        setError(res.error ?? "Anonymisierung fehlgeschlagen.");
        return;
      }
      if (res.text) setAnonText(res.text);
    });
  }

  async function buildLink(mode: ShareMode): Promise<string | null> {
    let t = token;
    if (!t) {
      const res = await ensureShareToken(mandateId);
      if (!res.ok || !res.token) {
        setError(res.error ?? "Link konnte nicht erstellt werden.");
        return null;
      }
      t = res.token;
      setToken(t);
    }
    const base = `${window.location.origin}/stelle/${t}`;
    return mode === "original" ? `${base}?ansicht=original` : base;
  }

  async function share(mode: ShareMode) {
    setError(null);
    if (mode === "anonym" && !anonText) {
      setError("Bitte zuerst anonymisieren, dann den anonymisierten Link teilen.");
      return;
    }
    const url = await buildLink(mode);
    if (!url) return;
    const shareData = {
      title: `Stellenangebot: ${role}`,
      text: `Spannende Position: ${role}`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(mode);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch {
      /* Abbruch durch Nutzer:in – ignorieren */
    }
  }

  async function mailto(mode: ShareMode) {
    const url = await buildLink(mode);
    if (!url) return;
    const subject = encodeURIComponent(`Stellenangebot: ${role}`);
    const body = encodeURIComponent(
      `Hallo,\n\nich habe eine spannende Position, die zu Ihrem Profil passen könnte:\n${role}\n\nAlle Details:\n${url}\n\nBei Interesse freue ich mich auf Ihre Rückmeldung.\n\nBeste Grüße`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  if (!jobPosting) {
    return (
      <p className="text-sm text-muted">
        Noch keine Original-Stellenausschreibung hinterlegt. Füge sie über „Mandat bearbeiten“ hinzu –
        das CRM versteht dann genau, was gesucht wird (besseres Search &amp; Match), und du kannst die
        Anzeige anonymisiert teilen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Original (intern) */}
      <details className="rounded-xl border border-border bg-elevated/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted">
          Original-Ausschreibung (intern, Kunde sichtbar)
        </summary>
        <p className="max-h-48 overflow-y-auto whitespace-pre-line border-t border-border/60 px-3 py-2 text-xs text-ink">
          {jobPosting}
        </p>
      </details>

      {/* Anonymisierte Fassung */}
      <div className="rounded-xl border border-brand/30 bg-brand/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-brand-deep">Anonymisierte Fassung</p>
          <button
            type="button"
            onClick={runAnonymize}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-2.5 py-1.5 text-xs font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
          >
            <IconSpark size={13} /> {pending ? "anonymisiert …" : anonText ? "Neu anonymisieren" : "Anonymisieren"}
          </button>
        </div>
        {anonText ? (
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line text-xs text-ink">{anonText}</p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Noch nicht anonymisiert. Mit einem Klick erstellt die KI eine Fassung ohne Kundenbezug.
          </p>
        )}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {/* Teilen – fragt immer: anonymisiert (empfohlen) oder Original */}
      {!askShare ? (
        <button
          type="button"
          onClick={() => setAskShare(true)}
          className="w-full rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-deep hover:bg-brand/15"
        >
          Stellenanzeige weiterleiten / teilen
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-xs font-semibold text-ink">Welche Fassung möchtest du senden?</p>

          {/* Anonymisiert (empfohlen) */}
          <div className="rounded-lg border border-success/30 bg-success/[0.05] p-2.5">
            <p className="text-xs font-semibold text-success">Anonymisiert · empfohlen</p>
            <p className="mb-2 text-[0.7rem] text-muted">Kunde bleibt geschützt.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => share("anonym")}
                className="flex-1 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15"
              >
                {copied === "anonym" ? (
                  <span className="inline-flex items-center gap-1"><IconCheck size={12} /> kopiert</span>
                ) : (
                  "Link teilen"
                )}
              </button>
              <button
                type="button"
                onClick={() => mailto("anonym")}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-brand/40"
              >
                <IconMail size={13} /> E-Mail
              </button>
            </div>
          </div>

          {/* Original (Kunde sichtbar) */}
          <div className="rounded-lg border border-warning/30 bg-warning/[0.05] p-2.5">
            <p className="text-xs font-semibold text-warning">Original · Kunde sichtbar</p>
            <p className="mb-2 text-[0.7rem] text-muted">Nur bei ausdrücklichem Einverständnis senden.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => share("original")}
                className="flex-1 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-warning/40"
              >
                {copied === "original" ? (
                  <span className="inline-flex items-center gap-1"><IconCheck size={12} /> kopiert</span>
                ) : (
                  "Original-Link"
                )}
              </button>
              <button
                type="button"
                onClick={() => mailto("original")}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-warning/40"
              >
                <IconMail size={13} /> E-Mail
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAskShare(false)}
            className="w-full rounded-lg px-2 py-1 text-xs text-muted hover:text-ink"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}
