import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidate } from "@/lib/crm-data";
import { updateCandidate } from "@/lib/crm-actions";
import { CANDIDATE_FIELDS } from "@/lib/crm-forms";
import { aiConfigured } from "@/lib/ai/config";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { CandidateStageControl } from "@/components/cockpit/CandidateStageControl";
import { CvDownloadButton } from "@/components/cockpit/CvDownloadButton";
import { CandidateSkills } from "@/components/cockpit/CandidateSkills";
import { IconChevronRight, IconMail, IconPhone, IconFolder, IconUserCheck } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import type { CandidateStage } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

const STAGE: Record<CandidateStage, { label: string; tone: "neutral" | "sky" | "brand" | "success" | "danger" }> = {
  neu: { label: "Neu", tone: "neutral" },
  screening: { label: "Screening", tone: "sky" },
  interview: { label: "Interview", tone: "brand" },
  angebot: { label: "Angebot", tone: "brand" },
  platziert: { label: "Platziert", tone: "success" },
  abgelehnt: { label: "Abgelehnt", tone: "danger" },
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs text-faint">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value || "—"}</span>
    </div>
  );
}

export default async function KandidatDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const c = await getCandidate(params.id);
  if (!c) notFound();

  const stage = STAGE[c.stage] ?? STAGE.neu;
  const cvPath = c.cv_path;
  const isPdf = /\.pdf$/i.test(c.cv_filename ?? "");
  const canExtract = aiConfigured && Boolean(cvPath) && isPdf;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/cockpit/kandidaten" className="hover:text-ink">
          Kandidaten
        </Link>
        <IconChevronRight size={14} className="text-faint" />
        <span className="truncate text-ink">{c.name}</span>
      </nav>

      {/* Kopf */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-sky text-lg font-black text-white">
              {initials(c.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-ink">{c.name}</h1>
              <p className="text-sm text-muted">{c.role || "Position offen"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={stage.tone}>{stage.label}</Badge>
                {c.source ? <Badge tone="neutral">{c.source}</Badge> : null}
                {c.mandate_account ? (
                  <Badge tone="sky">{c.mandate_account}</Badge>
                ) : null}
              </div>
            </div>
            <EditDialog
              id={c.id}
              title="Kandidat:in bearbeiten"
              fields={CANDIDATE_FIELDS}
              action={updateCandidate}
              initial={{
                name: c.name,
                role: c.role,
                email: c.email ?? "",
                phone: c.phone ?? "",
                mandate_account: c.mandate_account,
                stage: c.stage,
                source: c.source,
              }}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Hauptspalte */}
        <div className="space-y-6 lg:col-span-2">
          {/* Kontakt */}
          <Card>
            <CardBody>
              <SectionHeader title="Kontakt" />
              {c.email || c.phone ? (
                <div className="space-y-2.5">
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-2.5 text-sm text-ink hover:text-brand"
                    >
                      <IconMail size={16} className="text-faint" /> {c.email}
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, "")}`}
                      className="flex items-center gap-2.5 text-sm text-ink hover:text-brand"
                    >
                      <IconPhone size={16} className="text-faint" /> {c.phone}
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">Keine Kontaktdaten hinterlegt.</p>
              )}
            </CardBody>
          </Card>

          {/* Lebenslauf */}
          <Card>
            <CardBody>
              <SectionHeader
                title="Lebenslauf"
                hint={c.cv_uploaded_at ? `hochgeladen am ${formatDate(c.cv_uploaded_at)}` : undefined}
              />
              {cvPath ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand/10 text-brand-deep">
                      <IconFolder size={16} />
                    </span>
                    <span className="truncate text-sm text-ink">
                      {c.cv_filename || "CV-Datei"}
                    </span>
                  </div>
                  <CvDownloadButton path={cvPath} />
                </div>
              ) : (
                <EmptyState
                  icon={<IconFolder size={22} />}
                  title="Kein CV hinterlegt. Über die Kandidaten-Seite hochladen."
                />
              )}
            </CardBody>
          </Card>

          {/* Skills */}
          <Card>
            <CardBody>
              <SectionHeader title="Skill-Set" hint="aus dem Lebenslauf" />
              <CandidateSkills id={c.id} skills={c.skills ?? []} canExtract={canExtract} />
            </CardBody>
          </Card>
        </div>

        {/* Seitenspalte */}
        <div className="space-y-6">
          {/* Phase */}
          <Card>
            <CardBody>
              <SectionHeader title="Phase" hint="im Recruiting-Prozess" />
              <CandidateStageControl id={c.id} stage={c.stage} />
            </CardBody>
          </Card>

          {/* Stammdaten */}
          <Card>
            <CardBody>
              <SectionHeader title="Übersicht" />
              <div className="divide-y divide-border">
                <MetaRow label="Mandat / Account" value={c.mandate_account} />
                <MetaRow label="Quelle" value={c.source} />
                <MetaRow
                  label="CV hochgeladen"
                  value={c.cv_uploaded_at ? formatDate(c.cv_uploaded_at) : "—"}
                />
                <MetaRow
                  label="Zuletzt aktualisiert"
                  value={c.updated_at ? formatDate(c.updated_at) : "—"}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
