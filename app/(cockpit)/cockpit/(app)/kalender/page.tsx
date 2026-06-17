import { headers } from "next/headers";
import { getCalendarTasks, getCalendarToken } from "@/lib/tasks-data";
import { getAccounts, getCandidates, getKiProjects, getMandates } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CopyField } from "@/components/cockpit/CopyField";
import { CalendarView } from "@/components/cockpit/CalendarView";
import { TaskCreateDialog } from "@/components/cockpit/TaskCreateDialog";
import { GoogleCalendarConnect } from "@/components/cockpit/GoogleCalendarConnect";
import {
  getValidAccessToken,
  fetchGoogleEvents,
  googleConfigured,
  type GoogleEvent,
} from "@/lib/google-calendar";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Prüft ob der aktuelle User einen Google-Token in der DB hat. */
async function checkGoogleConnected(): Promise<boolean> {
  if (useMockData || !hasServiceRole()) return false;
  try {
    const userClient = createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return false;

    const svc = createServiceClient();
    const { data: partner } = await svc
      .from("partners")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (!partner) return false;

    const { data } = await svc
      .from("google_calendar_tokens")
      .select("id")
      .eq("partner_id", (partner as { id: string }).id)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams?: { google_connected?: string; google_error?: string };
}) {
  // ── Parallele Daten-Ladung ────────────────────────────────────────
  const [tasks, token, accounts, candidates, ki, mandates, googleConnected] =
    await Promise.all([
      getCalendarTasks(),
      getCalendarToken(),
      getAccounts(),
      getCandidates(),
      getKiProjects(),
      getMandates(),
      checkGoogleConnected(),
    ]);

  // ── Google-Events laden (nur wenn verbunden) ───────────────────────
  let googleEvents: GoogleEvent[] = [];
  if (googleConnected) {
    const auth = await getValidAccessToken();
    if (auth) {
      // Fenster: 2 Monate zurück + 4 Monate voraus.
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString();
      googleEvents = await fetchGoogleEvents(
        auth.token,
        auth.calendarId,
        timeMin,
        timeMax
      );
    }
  }

  // ── ICS-Abo-URL ────────────────────────────────────────────────────
  const h = headers();
  const host = h.get("host") ?? "deine-app.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const icsUrl = token.token ? `${proto}://${host}/api/calendar/${token.token}` : "";

  // ── Entity-Listen für Task-Dialog ──────────────────────────────────
  const customers = accounts.map((a) => ({ label: a.name, id: a.id }));
  const cands = candidates.map((c) => ({ label: c.name, id: c.id }));
  const projects = [
    ...ki.map((p) => ({ label: `${p.account_name} · ${p.product}`, id: p.id })),
    ...mandates.map((m) => ({ label: `${m.account_name} · ${m.role}`, id: m.id })),
  ];

  // ── URL-Params aus OAuth-Redirect ──────────────────────────────────
  const justConnected = searchParams?.google_connected === "1";
  const googleError = searchParams?.google_error ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planung"
        title="Kalender"
        description="Termine und Aufgaben – an Kunde, Projekt oder Kandidat:in gebunden."
        action={
          <TaskCreateDialog
            customers={customers}
            candidates={cands}
            projects={projects}
            autoOpenParam="new"
          />
        }
      />

      {/* ── Sync-Karte: ICS (read-only) + Google 2-Wege ─────────────── */}
      <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
        <CardBody className="space-y-4">
          <SectionHeader
            title="Kalender-Synchronisation"
            action={
              <Badge tone={token.demo ? "warning" : "success"}>
                {token.demo ? "Demo" : "Aktiv"}
              </Badge>
            }
          />

          {/* Google 2-Wege-Sync */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted">
              2-Wege-Sync (Google Calendar)
            </p>
            <p className="text-xs text-faint">
              CRM-Aufgaben werden automatisch als Events in deinen Google Kalender
              übertragen. Google-Events erscheinen in dieser Ansicht (read-only).
            </p>
            <GoogleCalendarConnect
              connected={googleConnected}
              configured={googleConfigured()}
              error={googleError}
              justConnected={justConnected}
            />
          </div>

          {/* ICS-Abo (read-only, Fallback/Ergänzung) */}
          <div className="space-y-1.5 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted">
              Abo-Link (read-only, Outlook / Apple Calendar)
            </p>
            {icsUrl ? <CopyField value={icsUrl} /> : null}
            <div className="grid gap-3 text-xs text-muted sm:grid-cols-2">
              <p>
                <span className="font-medium text-ink">Google Kalender:</span>{" "}
                Andere Kalender → „Per URL hinzufügen" → Link einfügen.
              </p>
              <p>
                <span className="font-medium text-ink">Outlook:</span>{" "}
                Kalender hinzufügen → „Aus dem Internet abonnieren" → Link einfügen.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Kalender-Grid + Agenda ────────────────────────────────────── */}
      <CalendarView tasks={tasks} googleEvents={googleEvents} />
    </div>
  );
}
