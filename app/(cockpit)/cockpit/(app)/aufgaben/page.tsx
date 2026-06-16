import { getOpenTasks } from "@/lib/tasks-data";
import { getAccounts, getCandidates, getKiProjects, getMandates } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { OpenTasksList } from "@/components/cockpit/OpenTasksList";
import { TaskCreateDialog } from "@/components/cockpit/TaskCreateDialog";

export const dynamic = "force-dynamic";

export default async function AufgabenPage() {
  const [tasks, accounts, candidates, ki, mandates] = await Promise.all([
    getOpenTasks(),
    getAccounts(),
    getCandidates(),
    getKiProjects(),
    getMandates(),
  ]);

  const customers = accounts.map((a) => ({ label: a.name, id: a.id }));
  const cands = candidates.map((c) => ({ label: c.name, id: c.id }));
  const projects = [
    ...ki.map((p) => ({ label: `${p.account_name} · ${p.product}`, id: p.id })),
    ...mandates.map((m) => ({ label: `${m.account_name} · ${m.role}`, id: m.id })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="To-do"
        title="Meine Aufgaben"
        description="Alle offenen Aufgaben über deine Accounts – nach Fälligkeit sortiert."
        action={<TaskCreateDialog customers={customers} candidates={cands} projects={projects} />}
      />
      <OpenTasksList tasks={tasks} />
    </div>
  );
}
