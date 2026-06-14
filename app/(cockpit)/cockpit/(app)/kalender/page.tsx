import { headers } from "next/headers";
import { getCalendarTasks, getCalendarToken } from "@/lib/tasks-data";
import { getAccounts, getCandidates, getKiProjects, getMandates } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CopyField } from "@/components/cockpit/CopyField";
import { CalendarView } from "@/components/cockpit/CalendarView";
import { TaskCreateDialog } from "@/components/cockpit/TaskCreateDialog";

export const dynamic = "force-dynamic";

export default async function KalenderPage() {
  const [tasks, token, accounts, candidates, ki, mandates] = await Promise.all([
    getCalendarTasks(),
    getCalendarToken(),
    getAccounts(),
    getCandidates(),
    getKiProjects(),
    getMandates(),
  ]);

  const h = headers();
  const host = h.get("host") ?? "deine-app.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const icsUrl = token.token ? `${proto}://${host}/api/calendar/${token.token}` : "";

  const customers = accounts.map((a) => ({ label: a.name, id: a.id }));
  const cands = candidates.map((c) => ({ label: c.name, id: c.id }));
  const projects = [
    ...ki.map((p) => ({ label: `${p.account_name} · ${p.product}`, id: p.id })),
    ...mandates.map((m) => ({ label: `${m.account_name} · ${m.role}`, id: m.id })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planung"
        title="Kalender"
        description="Termine und Aufgaben – an Kunde, Projekt oder Kandidat:in gebunden."
        action={
          <TaskCreateDialog customers={customers} candidates={cands} projects={projects} autoOpenParam="new" />
        }
      />

      <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
        <CardBody className="space-y-3">
          <SectionHeader
            title="Mit Google / Outlook synchronisieren"
            hint="Abo-Link (read-only)"
            action={
              <Badge tone={token.demo ? "warning" : "success"}>
                {token.demo ? "Demo" : "Aktiv"}
              </Badge>
            }
          />
          {icsUrl ? <CopyField value={icsUrl} /> : null}
          <div className="grid gap-3 border-t border-border/60 pt-3 text-sm text-muted sm:grid-cols-2">
            <p>
              <span className="font-medium text-ink">Google Kalender:</span> Andere
              Kalender → „Per URL hinzufügen“ → diese URL einfügen.
            </p>
            <p>
              <span className="font-medium text-ink">Outlook:</span> Kalender
              hinzufügen → „Aus dem Internet abonnieren“ → URL einfügen.
            </p>
          </div>
        </CardBody>
      </Card>

      <CalendarView tasks={tasks} />
    </div>
  );
}
