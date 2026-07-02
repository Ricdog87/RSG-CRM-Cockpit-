"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconBolt } from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import { syncProjectsAction } from "@/lib/matches-actions";

/** Stößt den read-only HubSpot-Projekt-Sync aus der UI an. */
export function SyncProjectsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await syncProjectsAction();
      if (res.ok) {
        toast.success(`HubSpot-Sync fertig – ${res.synced ?? 0} Projekt(e) gespiegelt.`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Sync fehlgeschlagen.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title="Offene Recruiting-Deals aus HubSpot spiegeln (read-only)"
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-elevated disabled:opacity-60"
    >
      <IconBolt size={14} className="flex-none" /> {pending ? "Synce …" : "HubSpot-Sync"}
    </button>
  );
}
