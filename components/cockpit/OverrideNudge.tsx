import { Card, CardBody } from "@/components/ui/Card";
import { InvitePartnerButton } from "@/components/cockpit/InvitePartnerButton";
import { formatEur } from "@/lib/format";
import type { OverrideEligibility, PartnerEarnings } from "@/lib/types";

/**
 * Handlungsleitender Override-Nudge. Wird NUR gezeigt, wenn
 * override_pausiert > 0 — dann fehlen aktive Direktpartner:innen.
 */
export function OverrideNudge({
  earnings,
  override,
}: {
  earnings: PartnerEarnings;
  override: OverrideEligibility;
}) {
  if (earnings.override_pausiert <= 0) return null;

  const fehlend = Math.max(
    0,
    override.min_active_directs - override.active_direct_count
  );

  return (
    <Card className="border-warning/30 bg-gradient-to-br from-warning/10 via-surface to-surface">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-warning/15 text-warning">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-ink">
              {formatEur(earnings.override_pausiert)} Override sind pausiert
            </p>
            <p className="mt-1 text-sm text-muted">
              {fehlend > 0 ? (
                <>
                  Dir {fehlend === 1 ? "fehlt" : "fehlen"}{" "}
                  <span className="font-semibold text-warning">
                    {fehlend} aktive:r Direktpartner:in
                  </span>
                  , um deinen Override wieder freizuschalten. Aktuell:{" "}
                  {override.active_direct_count} von {override.min_active_directs}.
                </>
              ) : (
                <>
                  Sobald deine Direktpartner:innen wieder aktiv abrechnen, läuft
                  dein Override automatisch weiter.
                </>
              )}
            </p>
          </div>
        </div>
        <InvitePartnerButton
          variant="primary"
          className="flex-none"
          label="Direktpartner:in einladen"
        />
      </CardBody>
    </Card>
  );
}
