"use client";

import { useState, useTransition } from "react";
import { respondToJob } from "@/lib/job-response";

export function JobInterestForm({ token, role }: { token: string; role: string }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "interested" | "declined">(null);

  function respond(interested: boolean) {
    setError(null);
    start(async () => {
      const res = await respondToJob(token, name, email, interested);
      if (!res.ok) return setError(res.error ?? "Fehlgeschlagen.");
      setDone(interested ? "interested" : "declined");
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-elevated/40 px-5 py-6 text-center">
        {done === "interested" ? (
          <>
            <p className="text-base font-bold text-ink">Vielen Dank für Ihr Interesse!</p>
            <p className="mt-1 text-sm text-muted">
              Ihre Daten sind eingegangen. Wir melden uns zeitnah mit den nächsten Schritten.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-bold text-ink">Danke für Ihre Rückmeldung.</p>
            <p className="mt-1 text-sm text-muted">
              Schade – vielleicht passt eine andere Position. Wir haben Ihre Absage vermerkt.
            </p>
          </>
        )}
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

  return (
    <div className="rounded-2xl border border-border bg-elevated/30 p-4 sm:p-5">
      <p className="text-sm font-semibold text-ink">Passt die Position zu Ihnen?</p>
      <p className="mb-3 text-xs text-muted">
        Kurz Kontaktdaten angeben – wir melden uns. Unverbindlich.
      </p>
      <div className="space-y-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ihr Name"
          autoComplete="name"
          className={inputCls}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ihre E-Mail"
          type="email"
          autoComplete="email"
          className={inputCls}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-brand to-sky px-4 py-2.5 text-sm font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
        >
          {pending ? "…" : "Interessiert"}
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={pending}
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted hover:text-ink disabled:opacity-60"
        >
          Nicht interessiert
        </button>
      </div>
      <p className="mt-2 text-center text-[0.65rem] text-faint">
        Mit dem Absenden stimmen Sie der Kontaktaufnahme zur Position „{role}“ zu.
      </p>
    </div>
  );
}
