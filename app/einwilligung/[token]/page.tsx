import type { Metadata } from "next";
import { getConsentByToken } from "@/lib/consent-data";
import { ConsentForm } from "@/components/cockpit/ConsentForm";
import {
  CONSENT_CONTROLLER,
  CONSENT_PRIVACY_EMAIL,
} from "@/lib/consent-email";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Einwilligung zur Datenverarbeitung · RSG",
  robots: { index: false, follow: false },
};

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
          {CONSENT_CONTROLLER} · Verantwortlicher i.S.d. DSGVO · {CONSENT_PRIVACY_EMAIL}
        </p>
      </div>
    </main>
  );
}

export default async function EinwilligungPage({
  params,
}: {
  params: { token: string };
}) {
  const consent = await getConsentByToken(params.token);

  if (!consent) {
    return (
      <Shell>
        <div className="px-6 py-8 sm:px-8">
          <h1 className="text-lg font-bold text-ink">Link ungültig</h1>
          <p className="mt-2 text-sm text-muted">
            Dieser Einwilligungs-Link ist ungültig oder wurde zurückgezogen. Bitte wenden Sie sich an
            Ihren Ansprechpartner bei der {CONSENT_CONTROLLER}.
          </p>
        </div>
      </Shell>
    );
  }

  const expired =
    consent.status !== "granted" &&
    Boolean(consent.expires_at) &&
    new Date(consent.expires_at as string) < new Date();
  const hello = consent.candidate_name ? `Hallo ${consent.candidate_name.split(" ")[0]},` : "Hallo,";

  return (
    <Shell>
      <div className="border-b border-border bg-gradient-to-br from-brand to-sky px-6 py-7 sm:px-8">
        <h1 className="text-xl font-bold text-white">Einwilligung zur Datenverarbeitung</h1>
        <p className="mt-1 text-sm text-white/80">Bewerbung &amp; Personalvermittlung</p>
      </div>

      <div className="space-y-5 px-6 py-7 text-sm leading-relaxed text-ink sm:px-8">
        <p className="text-muted">{hello}</p>
        <p className="text-muted">
          damit wir Sie für passende Positionen berücksichtigen können, bitten wir um Ihre Einwilligung
          in die Verarbeitung Ihrer Bewerbungsdaten durch die <strong className="text-ink">{CONSENT_CONTROLLER}</strong>.
        </p>

        <div className="rounded-xl border border-border bg-elevated/50 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Worum geht es konkret</h2>
          <ul className="ml-4 list-disc space-y-1.5 text-muted">
            <li><span className="text-ink">Verantwortlicher:</span> {CONSENT_CONTROLLER}, Kontakt Datenschutz: {CONSENT_PRIVACY_EMAIL}</li>
            <li><span className="text-ink">Zweck:</span> Speicherung &amp; Verarbeitung Ihrer Bewerbungsunterlagen (inkl. Lebenslauf, Kontakt- und Qualifikationsdaten) zur Vermittlung an passende Positionen.</li>
            <li><span className="text-ink">Weitergabe:</span> ggf. Übermittlung Ihres Profils an potenzielle Arbeitgeber – ausschließlich im Rahmen einer konkreten Vermittlung.</li>
            <li><span className="text-ink">Rechtsgrundlage:</span> Ihre Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.</li>
            <li><span className="text-ink">Speicherdauer:</span> bis zum Widerruf, längstens 24 Monate nach dem letzten Kontakt.</li>
            <li><span className="text-ink">Ihre Rechte:</span> Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit sowie jederzeitiger Widerruf mit Wirkung für die Zukunft.</li>
          </ul>
        </div>

        <ConsentForm
          token={consent.token}
          initialStatus={consent.status}
          grantedAt={consent.granted_at}
          expired={expired}
        />

        <p className="border-t border-border pt-4 text-xs text-faint">
          Der Widerruf ist jederzeit formlos möglich, z.&nbsp;B. per E-Mail an{" "}
          <a href={`mailto:${CONSENT_PRIVACY_EMAIL}`} className="text-brand-deep underline">
            {CONSENT_PRIVACY_EMAIL}
          </a>
          . Durch den Widerruf wird die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung nicht berührt.
        </p>
      </div>
    </Shell>
  );
}
