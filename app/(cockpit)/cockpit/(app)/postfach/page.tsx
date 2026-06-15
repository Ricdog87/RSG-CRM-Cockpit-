import { headers } from "next/headers";
import { getInboxAddress, getEmailActivities } from "@/lib/email-data";
import { hasServiceRole } from "@/lib/supabase/service";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { EmailTimeline } from "@/components/cockpit/EmailTimeline";
import { EmailSetupGuide } from "@/components/cockpit/EmailSetupGuide";

export const dynamic = "force-dynamic";

export default async function PostfachPage() {
  const [inbox, emails] = await Promise.all([
    getInboxAddress(),
    getEmailActivities(),
  ]);

  // Absolute Webhook-URL aus dem aktuellen Host ableiten (Preview/Prod).
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "rsg-crm-cockpit.vercel.app";
  const proto = h.get("x-forwarded-proto") || "https";
  const webhookUrl = `${proto}://${host}/api/email/inbound`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="E-Mail-Tracking"
        title="Postfach"
        description="Jede gesendete & empfangene Mail automatisch beim passenden Kunden protokollieren – die HubSpot-Ablösung."
      />

      <EmailSetupGuide
        addresses={inbox.addresses}
        demo={inbox.demo}
        webhookUrl={webhookUrl}
        serviceRoleReady={hasServiceRole()}
        secretReady={Boolean(process.env.EMAIL_WEBHOOK_SECRET)}
      />

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
