"use client";

import { useState, useTransition } from "react";
import { respondToJob, type ResponseMode } from "@/lib/job-response";

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

export function JobInterestForm({ token, role }: { token: string; role: string }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | ResponseMode>(null);

  function submit(mode: ResponseMode) {
    setError(null);
    if (mode !== "declined" && !consent) {
      setError("Bitte die Datenschutz-Einwilligung bestätigen.");
      return;
    }
    start(async () => {
      const res = await respondToJob(token, { name, email, phone, consent, mode });
      if (!res.ok) return setError(res.error ?? "Fehlgeschlagen.");
      setDone(mode);
    });
  }

  if (done) {
    const msg =
      done === "interested"
        ? { t: "Vielen Dank für Ihr Interesse!", s: "Ihre Daten sind eingegangen – wir melden uns zeitnah mit den nächsten Schritten." }
        : done === "talentpool"
          ? { t: "Sie sind im Talent-Pool!", s: "Diese Stelle passt gerade nicht – wir melden uns, sobald eine passende Position frei wird." }
          : { t: "Danke für Ihre Rückmeldung.", s: "Schade – vielleicht passt eine andere Position. Alles Gute!" };
    return (
      <div className="rounded-2xl border border-border bg-elevated/40 px-5 py-6 text-center">
        <p className="text-base font-bold text-ink">{msg.t}</p>
        <p className="mt-1 text-sm text-muted">{msg.s}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-elevated/30 p-4 sm:p-5">
      <p className="text-sm font-semibold text-ink">Passt die Position zu Ihnen?</p>
      <p className="mb-3 text-xs text-muted">
        Kurz Kontaktdaten angeben – wir melden uns. Unverbindlich &amp; vertraulich.
      </p>
      <div className="space-y-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ihr Name" autoComplete="name" className={inputCls} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ihre E-Mail" type="email" autoComplete="email" className={inputCls} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (optional)" type="tel" autoComplete="tel" className={inputCls} />
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none accent-brand"
        />
        <span className="text-xs text-muted">
          Ich willige ein, dass meine Daten zur Vermittlung passender Positionen durch RSG Recruiting
          gespeichert und verarbeitet werden. Die Einwilligung ist jederzeit widerrufbar (Datenschutz).
        </span>
      </label>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => submit("interested")}
          disabled={pending}
          className="w-full rounded-xl bg-gradient-to-r from-brand to-sky px-4 py-2.5 text-sm font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
        >
          {pending ? "…" : "Ja, ich bin interessiert"}
        </button>
        <button
          type="button"
          onClick={() => submit("talentpool")}
          disabled={pending}
          className="w-full rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand-deep hover:bg-brand/15 disabled:opacity-60"
        >
          Diese Stelle passt nicht – für künftige Stellen vormerken
        </button>
        <button
          type="button"
          onClick={() => submit("declined")}
          disabled={pending}
          className="w-full rounded-xl px-4 py-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-60"
        >
          Kein Interesse
        </button>
      </div>

      <p className="mt-2 text-center text-[0.65rem] text-faint">
        Position „{role}“ · Vermittlung vertraulich über RSG Recruiting.
      </p>
    </div>
  );
}
