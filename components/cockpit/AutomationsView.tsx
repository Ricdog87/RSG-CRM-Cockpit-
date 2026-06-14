"use client";

import { useState, useTransition } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { IconBolt } from "@/components/ui/icons";
import { setAutomation } from "@/lib/crm-actions";
import type { AutomationDef } from "@/lib/automations";

type Item = AutomationDef & { enabled: boolean };

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 flex-none rounded-full transition-colors",
        on ? "bg-brand-deep" : "bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[1.4rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function AutomationsView({ items }: { items: Item[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.key, i.enabled]))
  );
  const [, start] = useTransition();

  function toggle(key: string) {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    start(async () => {
      const res = await setAutomation(key, next);
      if (!res.ok) setState((s) => ({ ...s, [key]: !next }));
    });
  }

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const on = state[it.key];
        return (
          <Card key={it.key}>
            <CardBody className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl",
                    on ? "bg-brand/10 text-brand-deep" : "bg-elevated text-faint"
                  )}
                >
                  <IconBolt size={18} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{it.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{it.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">Auslöser: {it.trigger}</Badge>
                    <Badge tone="sky">{it.action}</Badge>
                  </div>
                </div>
              </div>
              <Switch on={on} onClick={() => toggle(it.key)} />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
