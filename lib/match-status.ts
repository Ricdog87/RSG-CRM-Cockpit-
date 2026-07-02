/**
 * Geteilte Status-Metadaten für Matches (Kandidat ↔ HubSpot-Projekt).
 * Bewusst ohne "server-only"/"use client" – nutzbar in Server- UND Client-Code.
 */
export type MatchStatus =
  | "VORGESCHLAGEN"
  | "GEPRUEFT"
  | "VORGESTELLT"
  | "ABGELEHNT"
  | "PLATZIERT";

export const MATCH_STATUS_META: Record<
  MatchStatus,
  { label: string; tone: "neutral" | "sky" | "brand" | "danger" | "success" }
> = {
  VORGESCHLAGEN: { label: "Vorgeschlagen", tone: "neutral" },
  GEPRUEFT: { label: "Geprüft", tone: "sky" },
  VORGESTELLT: { label: "Vorgestellt", tone: "brand" },
  ABGELEHNT: { label: "Abgelehnt", tone: "danger" },
  PLATZIERT: { label: "Platziert", tone: "success" },
};

export const MATCH_STATUS_OPTIONS = (Object.keys(MATCH_STATUS_META) as MatchStatus[]).map(
  (value) => ({ value, label: MATCH_STATUS_META[value].label })
);
