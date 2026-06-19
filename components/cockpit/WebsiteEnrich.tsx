"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconNetwork, IconSpark } from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import {
  enrichAccountFromWebsiteAction,
  type WebsiteEnrichResult,
} from "@/lib/ai-actions";

const FIELD_LABEL: Record<string, string> = {
  branche: "Branche",
  segment: "Segment",
  ort: "Ort",
  country: "Land",
};

/** Macht aus einer Domain eine klickbare externe URL. */
function toHref(domain: string): string {
  const d = domain.trim();
  return /^https?:\/\//i.test(d) ? d : `https://${d}`;
}

export function WebsiteEnrich({
  accountId,
  domain,
}: {
  accountId: string;
  domain?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<WebsiteEnrichResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setResult(null);
    start(async () => {
      const res = await enrichAccountFromWebsiteAction(accountId);
      if (res.ok) {
        setResult(res);
        if (res.demo) {
          toast.info("Demo-Modus: keine echten Daten geladen.");
        } else {
          const count = res.filled ? Object.keys(res.filled).length : 0;
          toast.success(
            count > 0
              ? `Öffentliche Daten geladen – ${count} Feld(er) ergänzt.`
              : "Öffentliche Daten geladen."
          );
          router.refresh();
        }
      } else {
        setError(res.error ?? "Anreicherung fehlgeschlagen.");
        if (res.error) toast.error(res.error);
      }
    });
  }

  const filledEntries = result?.filled ? Object.entries(result.filled) : [];

  return (
    <Card className="border-sky/30 bg-gradient-to-br from-sky/[0.05] to-brand/[0.04]">
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader title="Website" hint="Öffentliches Firmenprofil von der Website laden" />
          {domain ? (
            <Button onClick={run} disabled={pending} className="flex-none">
              <IconSpark size={16} />
              {pending ? "Lade …" : "Öffentliche Daten laden"}
            </Button>
          ) : null}
        </div>

        {domain ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted">
            <IconNetwork size={14} />
            <a
              href={toHref(domain)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-deep hover:underline"
            >
              {domain}
            </a>
          </p>
        ) : (
          <p className="rounded-lg border border-border bg-elevated/40 px-3 py-2 text-sm text-muted">
            Keine Domain hinterlegt. Domain im Bearbeiten-Dialog ergänzen.
          </p>
        )}

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        {result?.ok && !result.demo ? (
          <div className="animate-fade-up space-y-2">
            {filledEntries.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="kpi-label">Ergänzt:</span>
                {filledEntries.map(([k, v]) => (
                  <Badge key={k} tone="success">
                    {FIELD_LABEL[k] ?? k}: {v}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Keine leeren Felder zu ergänzen – Stammdaten waren bereits vollständig.
              </p>
            )}
            {result.beschreibung ? (
              <div>
                <p className="kpi-label mb-1">Firmenprofil (als Notiz gespeichert)</p>
                <p className="rounded-xl border border-border bg-surface p-3 text-sm text-ink">
                  {result.beschreibung}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
