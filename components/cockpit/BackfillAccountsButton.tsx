"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { backfillAccounts } from "@/lib/crm-actions";

/**
 * Materialisiert abgeleitete Kunden (aus Mandaten/KI-Projekten/Chancen/
 * Kandidaten) zu echten Account-Datensätzen. Idempotent – kann jederzeit
 * erneut ausgeführt werden.
 */
export function BackfillAccountsButton({ derivedCount = 0 }: { derivedCount?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  if (derivedCount <= 0 && !msg) return null;

  function run() {
    setMsg(null);
    start(async () => {
      const res = await backfillAccounts();
      if (!res.ok) {
        setMsg({ tone: "warn", text: res.error ?? "Fehlgeschlagen." });
        return;
      }
      if (res.demo) {
        setMsg({ tone: "ok", text: "Demo-Modus – nichts gespeichert." });
        return;
      }
      setMsg(
        res.warning
          ? { tone: "warn", text: res.warning }
          : { tone: "ok", text: `${res.created ?? 0} Kunde(n) als Datensatz angelegt.` }
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky/30 bg-sky/[0.05] px-3 py-2">
      <span className="text-xs text-muted">
        {derivedCount > 0
          ? `${derivedCount} Kunde(n) sind aus Mandaten/Projekten abgeleitet und noch nicht als Datensatz angelegt.`
          : "Abgeleitete Kunden materialisieren."}
      </span>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-sky/40 bg-sky/10 px-2.5 py-1.5 text-xs font-semibold text-sky-deep transition-colors hover:bg-sky/15 disabled:opacity-60"
        )}
      >
        <IconSpark size={12} /> {pending ? "Synchronisiere…" : "Als Kunden anlegen"}
      </button>
      {msg ? (
        <span className={cn("text-xs", msg.tone === "ok" ? "text-success" : "text-danger")}>{msg.text}</span>
      ) : null}
    </div>
  );
}
