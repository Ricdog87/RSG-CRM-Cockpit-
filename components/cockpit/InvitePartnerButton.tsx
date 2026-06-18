"use client";

import { Button } from "@/components/ui/Button";

/**
 * Öffnet eine vorbereitete Einladungs-E-Mail (mailto) für neue
 * Partner:innen. Personalisiert mit dem Namen der einladenden Person.
 */
export function InvitePartnerButton({
  inviterName,
  label = "Partner:in einladen",
  variant = "primary",
  className,
  withIcon = false,
}: {
  inviterName?: string;
  label?: string;
  variant?: "primary" | "ghost" | "subtle";
  className?: string;
  withIcon?: boolean;
}) {
  function invite() {
    const from = inviterName?.trim() || "dein RSG-Kontakt";
    const subject = "Einladung ins RSG-Partnerprogramm";
    const body = [
      "Hallo,",
      "",
      `ich möchte dich herzlich ins RSG-Partnerprogramm einladen. Als Partner:in profitierst du von unserem Recruiting- und KI-Portfolio und baust dir wiederkehrende Provisionen auf.`,
      "",
      "Melde dich gern bei mir – ich richte dir deinen Zugang ein und erkläre dir die ersten Schritte.",
      "",
      "Viele Grüße",
      from,
    ].join("\n");
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  }

  return (
    <Button variant={variant} className={className} onClick={invite} type="button">
      {withIcon ? <span aria-hidden>＋</span> : null} {label}
    </Button>
  );
}
