import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidate, getAccounts } from "@/lib/crm-data";
import { getNotesForCandidate } from "@/lib/notes-data";
import { getConsentForCandidate } from "@/lib/consent-data";
import { getSubmissionsForCandidate } from "@/lib/submissions-data";
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
import { CandidateCvUpload } from "@/components/cockpit/CandidateCvUpload";
import { CandidatePhoto } from "@/components/cockpit/CandidatePhoto";
import { AnonymizeButton } from "@/components/cockpit/AnonymizeButton";
import { CvPreview } from "@/components/cockpit/CvPreview";
import { CandidateRatingTags } from "@/components/cockpit/CandidateRatingTags";
import { CandidateMatch } from "@/components/cockpit/CandidateMatch";
import { CandidateMandateMatch } from "@/components/cockpit/CandidateMandateMatch";
import { CandidateSkills } from "@/components/cockpit/CandidateSkills";
import { CandidateActivity } from "@/components/cockpit/CandidateActivity";
import { CandidateConsent } from "@/components/cockpit/CandidateConsent";
import {
  IconChevronRight,
  IconMail,
  IconPhone,
  IconFolder,
  IconBriefcase,
} from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
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

function candNo(n?: number): string {
  return n != null ? `RSG-${String(n).padStart(5, "0")}` : "";
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

  const [notes, tasks, emails, accounts, consent, submissions] = await Promise.all([
    getNotesForCandidate(c.id),
    getTasksForRelated("candidate", c.id),
    getEmailActivitiesForCandidate(c.email),
    getAccounts(),
    getConsentForCandidate(c.id).catch(() => null),
    getSubmissionsForCandidate(c.id),
  ]);

  // Mandat/Account klickbar verknüpfen (Abgleich über den Namen).
  const mandateAccount = c.mandate_account
    ? accounts.find((a) => a.name === c.mandate_account)
    : undefined;

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
                  <CandidatePhoto
                    candidateId={c.id}
                    name={c.name}
                    photoPath={c.photo_path}
                    hasCv={Boolean(c.cv_path)}
                    size={56}
                  />
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-bold text-ink">{[c.salutation, c.title, c.name].filter(Boolean).join(" ")}</h1>
                    <p className="truncate text-sm text-muted">{c.role || "Position offen"}</p>
                    {c.candidate_no != null ? (
                      <p className="mt-0.5 font-mono text-[0.7rem] font-medium text-faint">{candNo(c.candidate_no)}</p>
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
                    salutation: c.salutation ?? "",
                    title: c.title ?? "",
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
                <Prop label="Ort / PLZ" value={[c.location, c.zip].filter(Boolean).join(" · ")} />
                <Prop
                  label="Gehaltsvorstellung"
                  value={c.salary_expectation ? `${formatEur(c.salary_expectation)}/J` : "—"}
                />
                <Prop label="Verfügbarkeit" value={c.availability} />
                <Prop
                  label="Mobilität"
                  value={[
                    c.willing_to_relocate == null ? "" : c.willing_to_relocate ? "umzugsbereit" : "kein Umzug",
                    c.travel_willingness ? `Reise: ${c.travel_willingness}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
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

          {/* Bewertung & Tags */}
          <Card>
            <CardBody>
              <SectionHeader title="Bewertung & Tags" hint="zum Priorisieren" />
              <CandidateRatingTags id={c.id} rating={c.rating ?? 0} tags={c.tags ?? []} />
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
              <SectionHeader title="DSGVO-Einwilligung" hint="Datenverarbeitung" />
              <CandidateConsent
                candidateId={c.id}
                hasEmail={Boolean(c.email)}
                status={consent?.status ?? "none"}
                sentAt={consent?.sent_at}
                grantedAt={consent?.granted_at}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeader title="Mandat / Account" hint="verknüpftes Unternehmen" />
              {c.mandate_account ? (
                mandateAccount ? (
                  <Link
                    href={`/cockpit/kunden/${mandateAccount.id}`}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5 hover:border-brand/40"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-sky/10 text-sky-deep">
                        <IconBriefcase size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink group-hover:text-brand-deep">
                          {mandateAccount.name}
                        </span>
                        <span className="block truncate text-xs text-faint">
                          {mandateAccount.branche || "Account öffnen"}
                        </span>
                      </span>
                    </span>
                    <IconChevronRight size={16} className="flex-none text-faint" />
                  </Link>
                ) : (
                  <p className="flex items-center gap-2.5 text-sm text-ink">
                    <IconBriefcase size={15} className="text-faint" /> {c.mandate_account}
                  </p>
                )
              ) : (
                <EmptyState title="Noch keinem Mandat zugeordnet." />
              )}
            </CardBody>
          </Card>

          {/* Vorstellungs-Historie (gegen Doppelbewerbung) */}
          <Card>
            <CardBody>
              <SectionHeader title="Vorstellungen" hint="Bewerbungshistorie" />
              {submissions.length === 0 ? (
                <EmptyState title="Noch keinem Mandat vorgestellt." />
              ) : (
                <ul className="space-y-2">
                  {submissions.map((sub) => (
                    <li
                      key={sub.id}
                      className="rounded-xl border border-border bg-elevated/40 px-3 py-2"
                    >
                      <p className="truncate text-sm font-medium text-ink">
                        {sub.account_name || "Mandat"}
                        {sub.role ? <span className="text-faint"> · {sub.role}</span> : null}
                      </p>
                      <p className="text-[0.7rem] text-faint">
                        {sub.stage} · {sub.created_at ? formatDate(sub.created_at) : ""}
                        {sub.mandate_id ? (
                          <>
                            {" · "}
                            <Link
                              href={`/cockpit/projekte/recruiting/${sub.mandate_id}`}
                              className="text-sky-deep hover:underline"
                            >
                              Mandat
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* KI-Matching zum aktuell verknüpften Mandat */}
          <Card>
            <CardBody>
              <SectionHeader title="KI-Matching" hint="Passung zum Mandat" />
              <CandidateMatch id={c.id} />
            </CardBody>
          </Card>

          {/* Reverse-Match: passende offene Mandate */}
          <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
            <CardBody>
              <SectionHeader title="Passende Mandate" hint="offene Suchprojekte für diese Person" />
              <CandidateMandateMatch candidateId={c.id} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeader title="Lebenslauf" hint="PDF oder Word" />
              {cvPath ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand/10 text-brand-deep">
                      <IconFolder size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{c.cv_filename || "CV-Datei"}</p>
                      {c.cv_uploaded_at ? (
                        <p className="text-[0.7rem] text-faint">
                          hochgeladen am {formatDate(c.cv_uploaded_at)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CvDownloadButton path={cvPath} />
                    <CandidateCvUpload candidateId={c.id} hasCv />
                  </div>
                  {isPdf ? <AnonymizeButton candidateId={c.id} /> : null}
                  {isPdf ? <CvPreview path={cvPath} /> : null}
                </div>
              ) : (
                <EmptyState
                  icon={<IconFolder size={20} />}
                  title="Kein CV hinterlegt. Lade die Bewerbungsunterlagen hoch."
                  action={<CandidateCvUpload candidateId={c.id} hasCv={false} />}
                />
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
