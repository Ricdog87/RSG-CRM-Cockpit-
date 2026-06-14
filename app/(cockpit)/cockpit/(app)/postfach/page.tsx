import { getInboxAddress, getEmailActivities } from "@/lib/email-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CopyField } from "@/components/cockpit/CopyField";
import { EmailTimeline } from "@/components/cockpit/EmailTimeline";
import { IconMail } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function PostfachPage() {
  const [inbox, emails] = await Promise.all([
    getInboxAddress(),
    getEmailActivities(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="E-Mail-Tracking"
        title="Postfach"
        description="Setz deine persönliche BCC-Adresse in Outlook oder Gmail – jede E-Mail wird automatisch beim passenden Kunden protokolliert."
      />

      <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
        <CardBody className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand-deep">
              <IconMail size={18} />
            </span>
            <div>
              <p className="font-semibold text-ink">Deine BCC-Tracking-Adresse</p>
              <p className="text-sm text-muted">
                Setze diese Adresse ins BCC-Feld – die Mail landet automatisch
                hier und beim richtigen Account (intelligenter Abgleich,
                Dublettenschutz).
              </p>
            </div>
          </div>

          {inbox.address ? <CopyField value={inbox.address} /> : null}
          {inbox.demo ? (
            <Badge tone="warning">
              Demo-Adresse · echte Adresse mit verbundener Supabase
            </Badge>
          ) : null}

          <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
            <div>
              <p className="kpi-label mb-1.5">Outlook / Office 365</p>
              <p className="text-sm text-muted">
                Beim Schreiben „BCC“ einblenden (Optionen → BCC) und die Adresse
                eintragen. Für jede Mail oder als Standard-Regel.
              </p>
            </div>
            <div>
              <p className="kpi-label mb-1.5">Gmail</p>
              <p className="text-sm text-muted">
                Im Verfassen-Fenster „BCC“ anklicken und die Adresse eintragen.
                Tipp: als Kontakt speichern für schnellen Zugriff.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionHeader
            title="Getrackte E-Mails"
            hint="automatisch erfasst und zugeordnet"
          />
          <EmailTimeline activities={emails} />
        </CardBody>
      </Card>
    </div>
  );
}
