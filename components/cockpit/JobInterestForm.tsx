"use client";

import { useRef, useState, useTransition } from "react";
import { submitJobResponse, type ResponseMode } from "@/lib/job-response";
import { IconCheck } from "@/components/ui/icons";

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

export function JobInterestForm({ token, role }: { token: string; role: string }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [cv, setCv] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | ResponseMode>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(mode: ResponseMode) {
    setError(null);
    if (mode !== "declined") {
      if (!consent) {
        setError("Bitte die Datenschutz-Einwilligung bestätigen.");
        return;
      }
      if (!cv && (!name.trim() || !email.trim())) {
        setError("Bitte Name und E-Mail angeben – oder einfach den CV hochladen.");
        return;
      }
    }
    const fd = new FormData();
    fd.set("token", token);
    fd.set("mode", mode);
    fd.set("name", name);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("consent", consent ? "1" : "0");
    if (cv) fd.set("cv", cv);
    start(async () => {
      const res = await submitJobResponse(fd);
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
        CV hochladen – wir füllen alles automatisch aus. Oder Felder selbst ausfüllen. Unverbindlich &amp; vertraulich.
      </p>

      {/* CV-Upload */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/[0.04] px-4 py-3 text-sm font-medium text-brand-deep hover:bg-brand/10"
      >
        {cv ? (
          <>
            <IconCheck size={15} className="flex-none text-success" /> <span className="truncate">{cv.name}</span>
          </>
        ) : (
          "Lebenslauf hochladen (PDF) – Felder automatisch ausfüllen"
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => setCv(e.target.files?.[0] ?? null)}
      />

      <div className="space-y-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ihr Name" autoComplete="name" className={inputCls} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ihre E-Mail" type="email" autoComplete="email" className={inputCls} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (optional)" type="tel" autoComplete="tel" className={inputCls} />
      </div>
      {cv ? (
        <p className="mt-1.5 text-[0.7rem] text-faint">
          Felder, die Sie leer lassen, ergänzen wir automatisch aus Ihrem CV.
        </p>
      ) : null}

      <label className="mt-3 flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-brand" />
        <span className="text-xs text-muted">
          Ich willige ein, dass meine Daten (inkl. Lebenslauf) zur Vermittlung passender Positionen durch
          RSG Recruiting gespeichert und verarbeitet werden. Jederzeit widerrufbar (Datenschutz).
        </span>
      </label>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <div className="mt-3 space-y-2">
        <button type="button" onClick={() => submit("interested")} disabled={pending}
          className="w-full rounded-xl bg-gradient-to-r from-brand to-sky px-4 py-2.5 text-sm font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60">
          {pending ? "…" : "Ja, ich bin interessiert"}
        </button>
        <button type="button" onClick={() => submit("talentpool")} disabled={pending}
          className="w-full rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand-deep hover:bg-brand/15 disabled:opacity-60">
          Diese Stelle passt nicht – für künftige Stellen vormerken
        </button>
        <button type="button" onClick={() => submit("declined")} disabled={pending}
          className="w-full rounded-xl px-4 py-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-60">
          Kein Interesse
        </button>
      </div>

      <p className="mt-2 text-center text-[0.65rem] text-faint">
        Position „{role}“ · Vermittlung vertraulich über RSG Recruiting.
      </p>
    </div>
  );
}
