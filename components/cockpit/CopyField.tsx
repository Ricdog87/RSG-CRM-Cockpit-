"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "@/components/ui/icons";

/** Schreibgeschütztes Feld mit Kopier-Button (z.B. BCC-Adresse). */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-elevated/50 px-3 py-2.5">
      <code className="min-w-0 flex-1 truncate text-sm text-ink">{value}</code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex flex-none items-center gap-1 rounded-lg bg-brand-deep px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-ink"
      >
        {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}
