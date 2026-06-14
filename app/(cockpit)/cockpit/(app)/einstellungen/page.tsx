import { getPartnerIdentity, getCockpitData } from "@/lib/data";
import { getInboxAddress } from "@/lib/email-data";
import { isSupabaseConfigured } from "@/lib/env";
import { AI, aiConfigured, webResearchEnabled } from "@/lib/ai/config";
import { hasServiceRole } from "@/lib/supabase/service";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyField } from "@/components/cockpit/CopyField";
import { IconLogout } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className={cn("h-2 w-2 rounded-full", ok ? "bg-success" : "bg-warning")} />
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>
      <span className="text-right text-xs text-muted">{detail}</span>
    </li>
  );
}

export default async function EinstellungenPage() {
  const [identity, cockpit, inbox] = await Promise.all([
    getPartnerIdentity(),
    getCockpitData(),
    getInboxAddress(),
  ]);

  const providerLabel =
    AI.provider === "anthropic"
      ? `Claude · ${AI.model}`
      : AI.provider === "openrouter"
        ? `OpenRouter · ${AI.model}`
        : "nicht verbunden";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Konto"
        title="Einstellungen"
        description="Profil, Verbindungen und deine BCC-Tracking-Adresse."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profil */}
        <Card>
          <CardBody>
            <SectionHeader title="Profil" />
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-sky text-base font-black text-white">
                {identity.display_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-ink">
                  {identity.display_name}
                </p>
                <p className="truncate text-sm text-muted">{identity.email || "—"}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
              <div>
                <p className="kpi-label">Karrierestufe</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  {cockpit.career.current.name}
                </p>
              </div>
              <form action="/cockpit/auth/signout" method="post">
                <Button variant="ghost" type="submit">
                  <IconLogout size={16} /> Abmelden
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>

        {/* Verbindungen */}
        <Card>
          <CardBody>
            <SectionHeader title="Verbindungen" hint="Live- vs. Demo-Status" />
            <ul className="divide-y divide-border">
              <StatusRow
                label="Datenbank (Supabase)"
                ok={isSupabaseConfigured}
                detail={isSupabaseConfigured ? "verbunden" : "Demo-Daten"}
              />
              <StatusRow
                label="KI (Lead Intelligence, Co-Pilot)"
                ok={aiConfigured}
                detail={providerLabel}
              />
              <StatusRow
                label="Web-Recherche (Perplexity)"
                ok={webResearchEnabled}
                detail={webResearchEnabled ? "aktiv" : "optional"}
              />
              <StatusRow
                label="E-Mail-Tracking (Webhook)"
                ok={hasServiceRole()}
                detail={hasServiceRole() ? "schreibbereit" : "Service-Role fehlt"}
              />
            </ul>
            {!isSupabaseConfigured ? (
              <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Demo-Modus: Setze die ENV-Variablen in Vercel und führe die
                Supabase-Migrationen aus, um live zu arbeiten (siehe README).
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* BCC-Adresse */}
      <Card>
        <CardBody>
          <SectionHeader
            title="BCC-Tracking-Adresse"
            hint="im BCC setzen – Mails landen automatisch beim Kunden"
            action={<Badge tone={inbox.demo ? "warning" : "success"}>{inbox.demo ? "Demo" : "Aktiv"}</Badge>}
          />
          {inbox.address ? <CopyField value={inbox.address} /> : null}
        </CardBody>
      </Card>
    </div>
  );
}
