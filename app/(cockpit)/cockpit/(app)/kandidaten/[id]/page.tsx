import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidate } from "@/lib/crm-data";
import { getNotesForCandidate } from "@/lib/notes-data";
import { getTasksForRelated } from "@/lib/tasks-data";
import { getEmailActivitiesForCandidate } from "@/lib/email-data";
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
import { CandidateActivity } from "@/components/cockpit/CandidateActivity";
import {
  IconChevronRight,
  IconMail,
  IconPhone,
  IconFolder,
  IconBriefcase,
} from "@/components/ui/icons";
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

function Prop({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs text-faint">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-ink">{value || "—"}</span>
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

  const [notes, tasks, emails] = await Promise.all([
    getNotesForCandidate(c.id),
    getTasksForRelated("candidate", c.id),
    getEmailActivitiesForCandidate(c.email),
  ]);

  const stage = STAGE[c.stage] ?? STAGE.neu;
  const cvPath = c.cv_path;
  const isPdf = /\.pdf$/i.test(c.cv_filename ?? "");
  const canExtract = aiConfigured && Boolean(cvPath) && isPdf;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/cockpit/kandidaten" className="hover:text-ink">
          Kandidaten
        </Link>
        <IconChevronRight size={14} className="text-faint" />
        <span className="truncate text-ink">{c.name}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Linke Spalte: Identität + Eigenschaften */}
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-sky text-base font-black text-white">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-bold text-ink">{c.name}</h1>
                    <p className="truncate text-sm text-muted">{c.role || "Position offen"}</p>
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

              <div className="flex flex-wrap gap-2">
                <Badge tone={stage.tone}>{stage.label}</Badge>
                {c.source ? <Badge tone="neutral">{c.source}</Badge> : null}
              </div>

              {/* Schnellaktionen */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={c.email ? `mailto:${c.email}` : undefined}
                  aria-disabled={!c.email}
                  className={
                    c.email
                      ? "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-elevated/60 py-2 text-xs font-medium text-ink hover:border-brand/40 hover:text-brand-deep"
                      : "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-elevated/30 py-2 text-xs font-medium text-faint"
                  }
                >
                  <IconMail size={14} /> E-Mail
                </a>
                <a
                  href={c.phone ? `tel:${c.phone.replace(/\s+/g, "")}` : undefined}
                  aria-disabled={!c.phone}
                  className={
                    c.phone
                      ? "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-elevated/60 py-2 text-xs font-medium text-ink hover:border-brand/40 hover:text-brand-deep"
                      : "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-elevated/30 py-2 text-xs font-medium text-faint"
                  }
                >
                  <IconPhone size={14} /> Anruf
                </a>
              </div>
            </CardBody>
          </Card>

          {/* Wichtige Informationen */}
          <Card>
            <CardBody>
              <SectionHeader title="Wichtige Informationen" />
              <div className="divide-y divide-border">
                <div className="py-2">
                  <span className="mb-1.5 block text-xs text-faint">Phase</span>
                  <CandidateStageControl id={c.id} stage={c.stage} />
                </div>
                <Prop
                  label="Mandat / Account"
                  value={
                    c.mandate_account ? (
                      <span className="inline-flex items-center gap-1.5">
                        <IconBriefcase size={13} className="text-faint" /> {c.mandate_account}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <Prop label="Quelle" value={c.source} />
                <Prop label="E-Mail" value={c.email} />
                <Prop label="Telefon" value={c.phone} />
                <Prop
                  label="CV hochgeladen"
                  value={c.cv_uploaded_at ? formatDate(c.cv_uploaded_at) : "—"}
                />
                <Prop
                  label="Zuletzt aktualisiert"
                  value={c.updated_at ? formatDate(c.updated_at) : "—"}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Mittlere Spalte: Aktivitäts-Center */}
        <div className="lg:col-span-6">
          <CandidateActivity
            candidateId={c.id}
            candidateName={c.name}
            notes={notes}
            tasks={tasks}
            emails={emails}
          />
        </div>

        {/* Rechte Spalte: Verknüpfungen / Dokumente */}
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardBody>
              <SectionHeader title="Lebenslauf" />
              {cvPath ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand/10 text-brand-deep">
                      <IconFolder size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{c.cv_filename || "CV-Datei"}</p>
                      {c.cv_uploaded_at ? (
                        <p className="text-[0.7rem] text-faint">{formatDate(c.cv_uploaded_at)}</p>
                      ) : null}
                    </div>
                  </div>
                  <CvDownloadButton path={cvPath} />
                </div>
              ) : (
                <EmptyState icon={<IconFolder size={20} />} title="Kein CV hinterlegt." />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeader title="Skill-Set" hint="aus dem Lebenslauf" />
              <CandidateSkills id={c.id} skills={c.skills ?? []} canExtract={canExtract} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
