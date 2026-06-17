"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconSpark, IconCopy, IconMail, IconCheck } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { draftFollowupAction } from "@/lib/ai-actions";
import type { BusinessLine } from "@/lib/crm-types";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

/** KI-Follow-up-Entwurf für einen Kunden (Betreff + Text, bearbeitbar). */
export function FollowupDrafter({
  account,
  line,
  context,
  sender,
  recipientEmail,
  goal,
}: {
  account: string;
  line: BusinessLine;
  context: string;
  sender?: string;
  recipientEmail?: string;
  goal?: string;
}) {
  const [pending, start] = useTransition();
  const [tone, setTone] = useState<"freundlich" | "direkt" | "beratend">("beratend");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    start(async () => {
      const res = await draftFollowupAction({ account, line, context, tone, goal, sender });
      if (res.ok && res.draft) {
        setSubject(res.draft.subject);
        setBody(res.draft.body);
        setMode(res.draft.mode);
      } else {
        setError(res.error ?? "Entwurf fehlgeschlagen.");
      }
    });
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`Betreff: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const mailto = `mailto:${recipientEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Card>
      <CardBody className="space-y-3">
        <SectionHeader
          title="KI-Follow-up"
          hint="Entwurf passend zum Kontext – bearbeitbar"
          action={
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
              aria-label="Tonalität"
            >
              <option value="beratend">beratend</option>
              <option value="freundlich">freundlich</option>
              <option value="direkt">direkt</option>
            </select>
          }
        />

        {!subject && !body ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted">Lass die KI einen passenden Follow-up-Text entwerfen.</span>
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
            >
              <IconSpark size={14} /> {pending ? "Entwerfe …" : "Entwurf erstellen"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Betreff</span>
              {mode ? <Badge tone={mode === "live" ? "success" : "warning"}>{mode === "live" ? "KI" : "Vorlage"}</Badge> : null}
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={cn(inputCls, "resize-y leading-relaxed")} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-elevated/70 disabled:opacity-60"
              >
                <IconSpark size={13} /> {pending ? "…" : "Neu"}
              </button>
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-elevated/70"
              >
                {copied ? <IconCheck size={13} className="text-success" /> : <IconCopy size={13} />} {copied ? "Kopiert" : "Kopieren"}
              </button>
              <a
                href={mailto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky/40 bg-sky/10 px-2.5 py-1.5 text-xs font-semibold text-sky-deep hover:bg-sky/15"
              >
                <IconMail size={13} /> In E-Mail öffnen
              </a>
            </div>
          </div>
        )}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </CardBody>
    </Card>
  );
}
