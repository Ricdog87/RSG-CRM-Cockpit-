"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { IconBolt, IconCheck, IconCopy } from "@/components/ui/icons";
import { sequencesFor, channelLabel } from "@/lib/sequences";
import { enrollAccountInSequence } from "@/lib/sequences-actions";

const SEQS = sequencesFor("account");

/** B2B-Outbound-Sequenz für einen Account (Kaltakquise-Kadenz als Aufgaben). */
export function AccountSequenceEnroll({
  accountId,
  accountName,
  defaultLine,
}: {
  accountId: string;
  accountName: string;
  defaultLine?: "ki" | "recruiting";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [key, setKey] = useState(
    (defaultLine === "recruiting" ? SEQS.find((s) => s.key === "akquise_recruiting") : SEQS[0])?.key ?? SEQS[0]?.key ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const seq = SEQS.find((s) => s.key === key);

  function enroll() {
    setError(null);
    start(async () => {
      const res = await enrollAccountInSequence(accountId, key);
      if (!res.ok) return setError(res.error ?? "Aufnahme fehlgeschlagen.");
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      if (!res.demo) router.refresh();
    });
  }

  function copyTemplate(t: string) {
    navigator.clipboard?.writeText(t.replace(/\{name\}/g, "").replace(/\{company\}/g, accountName));
  }

  if (SEQS.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <SectionHeader title="Outbound-Sequenz" hint="Kaltakquise-Kadenz als Aufgaben anlegen" />
        <select
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
        >
          {SEQS.map((s) => (
            <option key={s.key} value={s.key}>{s.name}</option>
          ))}
        </select>

        {seq ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">{seq.description}</p>
            <ol className="space-y-1.5">
              {seq.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-elevated/40 px-2.5 py-1.5">
                  <span className="mt-0.5 flex-none rounded-md bg-brand/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand-deep">
                    Tag {step.dayOffset}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink">
                      <span className="text-faint">{channelLabel[step.channel]}:</span> {step.title}
                    </p>
                    {step.template ? (
                      <button
                        type="button"
                        onClick={() => copyTemplate(step.template!)}
                        className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-medium text-sky-deep hover:underline"
                      >
                        <IconCopy size={11} /> Vorlage kopieren
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <button
          type="button"
          onClick={enroll}
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-2 text-xs font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
        >
          {done ? <IconCheck size={13} /> : <IconBolt size={13} />}
          {pending ? "nimmt auf …" : done ? "Aufgaben erstellt" : "In Sequenz aufnehmen"}
        </button>
      </CardBody>
    </Card>
  );
}
