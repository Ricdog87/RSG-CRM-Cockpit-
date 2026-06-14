import { getOpenTasks } from "@/lib/tasks-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { OpenTasksList } from "@/components/cockpit/OpenTasksList";

export const dynamic = "force-dynamic";

export default async function AufgabenPage() {
  const tasks = await getOpenTasks();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="To-do"
        title="Meine Aufgaben"
        description="Alle offenen Aufgaben über deine Accounts – nach Fälligkeit sortiert."
      />
      <OpenTasksList tasks={tasks} />
    </div>
  );
}
