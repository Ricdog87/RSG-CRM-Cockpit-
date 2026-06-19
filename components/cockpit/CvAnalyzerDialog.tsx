"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { analyzeCv, type CvAnalysis } from "@/lib/cv-actions";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconSpark, IconChevronRight, IconCopy, IconCheck } from "@/components/ui/icons";

/**
 * RSG CV Analyser – intelligenter CV-Upload:
 * 1) Upload → Dublettencheck → Kandidat:in anlegen/verknüpfen, Felder aus CV
 * 2) KI-Abgleich mit offenen Mandaten; kein Treffer → Recruiter-Zusammenfassung
 *    + Sourcing-Suchstrings (LinkedIn/Indeed/StepStone).
 */
const BUCKET = "candidate-cvs";

function safeName(n: string): string {
  return (n.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(-60)) || "cv";
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-faint">{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[0.7rem] text-muted hover:text-ink"
        >
          {copied ? <IconCheck size={11} /> : <IconCopy size={11} />} {copied ? "kopiert" : "kopieren"}
        </button>
      </div>
      <p className="break-words font-mono text-xs text-ink">{value}</p>
    </div>
  );
}

export function CvAnalyzerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvAnalysis | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setBusy(false); setPhase(""); setError(null); setResult(null);
  }

  async function handleFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setBusy(true); setError(null); setResult(null);
    try {
      setPhase("Lädt hoch …");
      const supabase = createClient();
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);

      setPhase("RSG CV Analyser liest den Lebenslauf …");
      const res = await analyzeCv({ cv_path: path, cv_filename: file.name });
      if (!res.ok) throw new Error(res.error ?? "Analyse fehlgeschlagen.");
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler bei der Analyse.");
    } finally {
      setBusy(false);
      setPhase("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const p = result?.profile;

  return (
    <>
      <Button
        variant="primary"
        onClick={() => { reset(); setOpen(true); }}
      >
        <IconSpark size={16} /> RSG CV Analyser
      </Button>

      <Dialog
        open={open}
        onClose={() => { if (!busy) setOpen(false); }}
        title="RSG CV Analyser"
        description="CV hochladen → Kandidat:in wird angelegt, Felder automatisch erkannt, Mandate abgeglichen."
      >
        <div className="space-y-4">
          {!result ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-elevated/40 px-4 py-8 text-center transition-colors hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-sm font-semibold text-ink">{busy ? phase : "CV auswählen (PDF)"}</span>
                <span className="text-xs text-muted">
                  {busy ? "einen Moment …" : "Analyse, Dublettencheck & Mandats-Abgleich in einem Schritt"}
                </span>
              </button>
              <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFile(e.target.files)} />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </>
          ) : (
            <div className="space-y-4">
              {/* Kandidat:in */}
              <div className="rounded-xl border border-border bg-elevated/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {[p?.title, p?.name].filter(Boolean).join(" ") || "Kandidat:in"}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[p?.role, p?.location, p?.seniority].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge tone={result.created ? "success" : "warning"}>
                    {result.created ? "neu angelegt" : "verknüpft"}
                  </Badge>
                </div>
                {result.duplicateOf && !result.created ? (
                  <p className="mt-1.5 text-xs text-warning">
                    Dublette erkannt ({result.duplicateOf.reason}) – Felder ergänzt statt doppelt anzulegen.
                  </p>
                ) : null}
                {result.enriched && result.enriched.length > 0 ? (
                  <p className="mt-1.5 text-xs text-faint">Übernommen: {result.enriched.join(", ")}</p>
                ) : null}
                {result.candidateId ? (
                  <Link
                    href={`/cockpit/kandidaten/${result.candidateId}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-deep hover:text-brand-ink"
                  >
                    Profil öffnen <IconChevronRight size={13} />
                  </Link>
                ) : null}
              </div>

              {/* Recruiter-Zusammenfassung */}
              {p?.summary ? (
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-faint">Einschätzung</p>
                  <p className="text-sm text-ink">{p.summary}</p>
                  {p.skills.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.skills.slice(0, 12).map((s) => (
                        <span key={s} className="rounded-full bg-elevated px-2 py-0.5 text-[0.7rem] text-muted">{s}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Mandats-Abgleich */}
              {result.hasMatch && result.matches && result.matches.length > 0 ? (
                <div className="rounded-xl border border-success/30 bg-success/[0.05] p-3">
                  <p className="mb-2 text-sm font-semibold text-ink">Passende offene Mandate</p>
                  <ul className="space-y-1.5">
                    {result.matches.filter((m) => m.score >= 30).map((m) => (
                      <li key={m.mandate_id}>
                        <Link
                          href={`/cockpit/projekte/recruiting/${m.mandate_id}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 hover:border-brand/40"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">{m.role || "Mandat"}</span>
                            <span className="block truncate text-xs text-faint">
                              {m.account_name}{m.factors.length ? ` · ${m.factors.join(", ")}` : ""}
                            </span>
                          </span>
                          <Badge tone={m.score >= 70 ? "success" : "sky"}>{m.score}%</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-brand/30 bg-brand/[0.04] p-3">
                  <p className="text-sm font-semibold text-ink">Kein passendes internes Mandat</p>
                  <p className="text-xs text-muted">
                    Kandidat:in in den Talent-Pool – und mit diesen Suchstrings aktiv passende
                    Vakanzen/Auftraggeber finden. Direkt kopieren &amp; einfügen:
                  </p>
                  {result.sourcing ? (
                    <div className="space-y-2">
                      <CopyRow label="LinkedIn" value={result.sourcing.linkedin} />
                      <CopyRow label="Indeed" value={result.sourcing.indeed} />
                      <CopyRow label="StepStone" value={result.sourcing.stepstone} />
                      <CopyRow label="Google X-Ray" value={result.sourcing.googleXray} />
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="ghost" onClick={() => reset()}>Weitere:n CV</Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>Schließen</Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
