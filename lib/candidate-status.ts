/**
 * Geteilte Metadaten für den Kandidaten-Verfügbarkeits-Status.
 * Bewusst ohne "server-only"/"use client" – nutzbar in Server- UND Client-Code.
 */
export type AvailabilityStatus =
  | "NEU"
  | "AKTIV_VERFUEGBAR"
  | "IN_VERMITTLUNG"
  | "PLATZIERT"
  | "INAKTIV"
  | "GESPERRT";

export const AVAILABILITY_META: Record<
  AvailabilityStatus,
  { label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" | "danger" }
> = {
  NEU: { label: "Neu", tone: "neutral" },
  AKTIV_VERFUEGBAR: { label: "Aktiv verfügbar", tone: "success" },
  IN_VERMITTLUNG: { label: "In Vermittlung", tone: "sky" },
  PLATZIERT: { label: "Platziert", tone: "brand" },
  INAKTIV: { label: "Inaktiv", tone: "warning" },
  GESPERRT: { label: "Gesperrt", tone: "danger" },
};

export function availabilityMeta(status?: string) {
  return AVAILABILITY_META[(status ?? "NEU") as AvailabilityStatus] ?? AVAILABILITY_META.NEU;
}
