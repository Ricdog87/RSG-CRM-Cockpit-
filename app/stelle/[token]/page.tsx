import type { Metadata } from "next";
import { getJobByShareToken } from "@/lib/job-posting-data";
import { JobInterestForm } from "@/components/cockpit/JobInterestForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stellenangebot · RSG Recruiting",
  robots: { index: false, follow: false },
};

/** Minimaler Markdown-Renderer (Überschriften, Aufzählungen, Absätze). */
function JobBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (bullets.length) {
      out.push(
        <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-sm text-ink">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flush(`f${i}`);
      return;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush(`f${i}`);
      out.push(
        <h2 key={i} className="mt-5 text-base font-bold text-ink first:mt-0">
          {line.replace(/^#{1,6}\s/, "")}
        </h2>
      );
    } else if (/^[-*]\s/.test(line)) {
      bullets.push(line.replace(/^[-*]\s/, ""));
    } else {
      flush(`f${i}`);
      out.push(
        <p key={i} className="my-2 text-sm leading-relaxed text-ink">
          {line.replace(/\*\*(.+?)\*\*/g, "$1")}
        </p>
      );
    }
  });
  flush("end");
  return <div>{out}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-sky text-sm font-black text-white">
            RSG
          </span>
          <span className="text-sm font-medium text-muted">Recruiting Solutions Group</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-faint">
          Vermittlung über RSG Recruiting · Bei Interesse antworten Sie direkt auf die Nachricht, mit
          der Sie diesen Link erhalten haben.
        </p>
      </div>
    </main>
  );
}

export default async function StellePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { ansicht?: string };
}) {
  const job = await getJobByShareToken(params.token);

  if (!job) {
    return (
      <Shell>
        <div className="px-6 py-8 sm:px-8">
          <h1 className="text-lg font-bold text-ink">Link ungültig</h1>
          <p className="mt-2 text-sm text-muted">
            Dieses Stellenangebot ist nicht (mehr) verfügbar. Bitte wenden Sie sich an Ihren
            Ansprechpartner bei RSG Recruiting.
          </p>
        </div>
      </Shell>
    );
  }

  // Standard: anonymisierte Fassung (Kundenschutz). Original nur bei explizitem
  // ?ansicht=original-Link, den der/die Recruiter:in bewusst teilt.
  const wantsOriginal = searchParams.ansicht === "original";
  const body = wantsOriginal
    ? job.job_posting || job.job_posting_anonymized
    : job.job_posting_anonymized || null;

  return (
    <Shell>
      <div className="border-b border-border bg-gradient-to-br from-brand/[0.06] to-sky/[0.05] px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-deep">
          Stellenangebot
        </p>
        <h1 className="mt-1 text-xl font-bold text-ink">{job.role}</h1>
      </div>
      <div className="px-6 py-6 sm:px-8">
        {body ? (
          <JobBody text={body} />
        ) : (
          <p className="text-sm text-muted">
            Die Details zu dieser Position werden gerade aufbereitet. Bitte kontaktieren Sie Ihren
            RSG-Ansprechpartner für mehr Informationen.
          </p>
        )}
        <div className="mt-6 border-t border-border pt-6">
          <JobInterestForm token={params.token} role={job.role} />
        </div>
      </div>
    </Shell>
  );
}
