/**
 * Projektplan-Vorlagen & Go-Live-Readiness für KI-Projekte (client-safe).
 */
export type MilestoneStatus = "offen" | "in_arbeit" | "erledigt";

export interface KiMilestone {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
  status: MilestoneStatus;
  target_date?: string;
  done_date?: string;
  notes?: string;
}

/** Standard-Projektplan eines KI-Implementierungsprojekts. */
export const DEFAULT_MILESTONES: string[] = [
  "Kickoff",
  "Anforderungen & Datenanbindung",
  "Konfiguration & Build",
  "Test & Abnahme",
  "Go-Live",
  "Hypercare",
  "Optimierung",
];

export const milestoneStatusMeta: Record<
  MilestoneStatus,
  { label: string; tone: "neutral" | "sky" | "success" }
> = {
  offen: { label: "Offen", tone: "neutral" },
  in_arbeit: { label: "In Arbeit", tone: "sky" },
  erledigt: { label: "Erledigt", tone: "success" },
};

/** Go-Live-Readiness-Checkliste (fixe Items, Status pro Projekt in DB). */
export const READINESS_ITEMS: { key: string; label: string }[] = [
  { key: "anforderungen", label: "Anforderungen & Erfolgskriterien abgestimmt" },
  { key: "daten", label: "Datenquellen angebunden" },
  { key: "telefonie", label: "Telefonie / Rufnummer eingerichtet" },
  { key: "prompts", label: "Gesprächsleitfaden / Prompts final" },
  { key: "test", label: "Testlauf erfolgreich" },
  { key: "abnahme", label: "Kundenfreigabe (Abnahme)" },
  { key: "dsgvo", label: "DSGVO / AVV unterzeichnet" },
  { key: "fallback", label: "Eskalations- / Fallback-Prozess definiert" },
  { key: "monitoring", label: "Monitoring & Alerting aktiv" },
];
