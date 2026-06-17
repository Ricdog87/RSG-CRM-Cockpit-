"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setKiProjectStatus, setKiProjectHealth } from "@/lib/crm-actions";
import type { Health, KiStatus } from "@/lib/crm-types";

const STATUS: { value: KiStatus; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "live", label: "Live" },
  { value: "optimierung", label: "Optimierung" },
  { value: "pausiert", label: "Pausiert" },
  { value: "gekuendigt", label: "Gekündigt" },
];
const HEALTH: { value: Health; label: string }[] = [
  { value: "gut", label: "Gesund" },
  { value: "neutral", label: "Stabil" },
  { value: "risiko", label: "Risiko" },
];

const sel = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink";

export function KiProjectControls({
  id,
  status,
  health,
}: {
  id: string;
  status: KiStatus;
  health: Health;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function changeStatus(v: string) {
    start(async () => {
      const res = await setKiProjectStatus(id, v);
      if (res.ok && !res.demo) router.refresh();
    });
  }
  function changeHealth(v: string) {
    start(async () => {
      const res = await setKiProjectHealth(id, v);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-faint">Status</label>
      <select value={status} disabled={pending} onChange={(e) => changeStatus(e.target.value)} className={sel}>
        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <label className="ml-2 text-xs text-faint">Health</label>
      <select value={health} disabled={pending} onChange={(e) => changeHealth(e.target.value)} className={sel}>
        {HEALTH.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
      </select>
    </div>
  );
}
