"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "@/components/ui/icons";
import { toast } from "@/lib/toast";

/**
 * Inline-Wert mit Ein-Klick-Kopieren (E-Mail, Telefon, IDs …).
 * Pragmatisch: Klick kopiert, kurzer Haken + Toast bestätigen.
 */
export function Copyable({
  value,
  label,
  className,
  empty = "—",
}: {
  value?: string | null;
  /** Was kopiert wurde – für den Toast (z.B. „E-Mail"). */
  label?: string;
  className?: string;
  empty?: string;
}) {
  const [copied, setCopied] = useState(false);
  const v = (value ?? "").trim();

  if (!v) return <span className={className}>{empty}</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      toast.success(`${label ? `${label} ` : ""}kopiert.`);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Kopieren nicht möglich.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label ?? "Wert"} kopieren`}
      className={`group inline-flex max-w-full items-center gap-1.5 text-left ${className ?? ""}`}
    >
      <span className="truncate">{v}</span>
      <span className="flex-none text-faint opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      </span>
    </button>
  );
}
