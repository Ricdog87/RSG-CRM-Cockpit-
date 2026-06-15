import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CopyField } from "@/components/cockpit/CopyField";
import { IconMail, IconCheck, IconBolt } from "@/components/ui/icons";

/**
 * HubSpot-artige Einrichtungs-Konsole fürs E-Mail-Tracking.
 * Zeigt die persönliche(n) Tracking-Adresse(n) und die konkreten Setup-Schritte:
 * 1) Google-Workspace-Auto-BCC-Regel (jede gesendete Mail automatisch),
 * 2) Inbound-Routing (DNS) je Domain → Webhook.
 */
export function EmailSetupGuide({
  addresses,
  demo,
  webhookUrl,
  serviceRoleReady,
  secretReady,
}: {
  addresses: { domain: string; address: string }[];
  demo: boolean;
  webhookUrl: string;
  serviceRoleReady: boolean;
  secretReady: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Tracking-Adressen */}
      <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
        <CardBody className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand-deep">
              <IconMail size={18} />
            </span>
            <div>
              <p className="font-semibold text-ink">Deine persönliche Tracking-Adresse</p>
              <p className="text-sm text-muted">
                Jede Mail, die diese Adresse als Empfänger/BCC enthält, wird
                automatisch dem passenden Kunden zugeordnet – intelligenter
                Abgleich über E-Mail & Domain, ohne Dubletten.
              </p>
            </div>
            <Badge tone={demo ? "warning" : "success"} className="ml-auto">
              {demo ? "Demo" : "Aktiv"}
            </Badge>
          </div>

          <div className="space-y-2">
            {addresses.map((a) => (
              <div key={a.domain}>
                <p className="kpi-label mb-1">{a.domain}</p>
                <CopyField value={a.address} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Schritt 1: Workspace Auto-BCC */}
      <Card>
        <CardBody>
          <SectionHeader
            title="1 · Auto-BCC in Google Workspace"
            hint="jede gesendete Mail automatisch tracken – wie HubSpot"
          />
          <ol className="space-y-2.5 text-sm text-muted">
            <Step>
              <a className="font-medium text-brand-deep underline" href="https://admin.google.com" target="_blank" rel="noreferrer">admin.google.com</a>{" "}
              öffnen (als Workspace-Admin für recruiting-sg.de).
            </Step>
            <Step>
              <b className="text-ink">Apps → Google Workspace → Gmail → Compliance</b>{" "}
              (bzw. „Routing“) aufrufen.
            </Step>
            <Step>
              Unter <b className="text-ink">Content Compliance</b> eine Regel
              „RSG CRM Tracking“ hinzufügen.
            </Step>
            <Step>
              Betroffene Nachrichten: <b className="text-ink">Outbound</b>{" "}
              (ausgehend). Bedingung: „Always match“ / alle.
            </Step>
            <Step>
              Aktion: <b className="text-ink">Auch zustellen an (Bcc)</b> → deine
              Tracking-Adresse oben eintragen, als{" "}
              <b className="text-ink">verstecktes (Bcc)</b> Ziel.
            </Step>
            <Step>
              Speichern. Nach wenigen Minuten landet <b className="text-ink">jede
              gesendete Mail</b> automatisch im CRM – ganz ohne Browser-Erweiterung.
            </Step>
          </ol>
          <p className="mt-3 rounded-lg border border-border/60 bg-elevated/40 px-3 py-2 text-xs text-faint">
            Kein Workspace-Admin? Alternative: in Gmail einen Weiterleitungs-Filter
            auf die Tracking-Adresse anlegen, oder die Adresse manuell ins BCC setzen.
          </p>
        </CardBody>
      </Card>

      {/* Schritt 2: Inbound-Routing / DNS */}
      <Card>
        <CardBody>
          <SectionHeader
            title="2 · Inbound-Routing einrichten (DNS)"
            hint="Mails an die Tracking-Adresse zum CRM-Webhook leiten"
          />
          <p className="mb-3 text-sm text-muted">
            Ein Inbound-Mail-Dienst (z.B. Mailgun Routes, SendGrid Inbound Parse
            oder CloudMailin – meist kostenlos) empfängt Mails an{" "}
            <code className="rounded bg-elevated px-1 text-ink">track+…@deine-domain</code>{" "}
            und meldet sie an den Webhook. Pro Domain einmalig:
          </p>
          <ol className="space-y-2.5 text-sm text-muted">
            <Step>Inbound-Domain beim Anbieter anlegen (je {addresses.length > 1 ? "Domain" : "deiner Domain"}).</Step>
            <Step>
              <b className="text-ink">MX-Record</b> der Domain auf den Anbieter
              zeigen lassen (laut dessen Anleitung).
            </Step>
            <Step>
              Inbound-Route/Webhook-Ziel setzen auf:
            </Step>
          </ol>
          <div className="mt-2">
            <CopyField value={webhookUrl} />
          </div>
          <ol className="mt-2.5 space-y-2.5 text-sm text-muted" start={4}>
            <Step>
              Header <code className="rounded bg-elevated px-1 text-ink">x-webhook-secret</code>{" "}
              mit deinem <code className="rounded bg-elevated px-1 text-ink">EMAIL_WEBHOOK_SECRET</code>{" "}
              mitsenden (Pflicht in Produktion).
            </Step>
          </ol>
        </CardBody>
      </Card>

      {/* Status / Voraussetzungen */}
      <Card>
        <CardBody>
          <SectionHeader title="Bereitschaft" hint="Voraussetzungen für Live-Tracking" />
          <ul className="space-y-2">
            <Ready ok={serviceRoleReady} label="Service-Role-Key gesetzt (Webhook schreibt eingehende Mails)" />
            <Ready ok={secretReady} label="EMAIL_WEBHOOK_SECRET gesetzt (Webhook-Schutz, Prod-Pflicht)" />
            <Ready ok={!demo} label="Supabase verbunden (echte Tracking-Adresse statt Demo)" />
          </ul>
        </CardBody>
      </Card>

      {/* Roadmap: was noch zum vollen HubSpot-Klon fehlt */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Nächste Ausbaustufen"
            hint="zum vollen HubSpot-Funktionsumfang"
          />
          <ul className="space-y-2.5 text-sm text-muted">
            <li className="flex gap-2">
              <IconBolt size={16} className="mt-0.5 flex-none text-sky-deep" />
              <span>
                <b className="text-ink">Öffnungs- & Klick-Tracking:</b> Tracking-Pixel
                + Link-Umschreibung. Funktioniert nur beim Versand über das CRM oder
                eine Gmail-Erweiterung (Auto-BCC kann nachträglich keinen Pixel
                einsetzen).
              </span>
            </li>
            <li className="flex gap-2">
              <IconBolt size={16} className="mt-0.5 flex-none text-sky-deep" />
              <span>
                <b className="text-ink">Gmail-Sidebar (Browser-Erweiterung):</b>{" "}
                Kontext zum Kontakt direkt im Posteingang, Compose-Tracking,
                Vorlagen – wie die HubSpot-Erweiterung.
              </span>
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand/10 text-[0.7rem] font-bold text-brand-deep">
        •
      </span>
      <span>{children}</span>
    </li>
  );
}

function Ready({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={
          ok
            ? "flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success/15 text-success"
            : "h-5 w-5 flex-none rounded-full border border-warning/50 bg-warning/10"
        }
      >
        {ok ? <IconCheck size={13} /> : null}
      </span>
      <span className={ok ? "text-ink" : "text-muted"}>{label}</span>
    </li>
  );
}
