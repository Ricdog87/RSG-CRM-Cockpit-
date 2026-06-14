/** Verknüpfungstypen für Aufgaben/Termine (Kunde/Projekt/Kandidat). */
export type RelatedType = "customer" | "project" | "candidate" | "none";

export const relatedTypeLabel: Record<RelatedType, string> = {
  customer: "Kunde",
  project: "Projekt",
  candidate: "Kandidat",
  none: "Allgemein",
};

/** Deeplink zum verknüpften Datensatz (soweit sinnvoll). */
export function relatedHref(type: RelatedType, id: string | null): string | null {
  if (type === "customer" && id) return `/cockpit/kunden/${id}`;
  if (type === "candidate") return "/cockpit/kandidaten";
  if (type === "project") return "/cockpit/projekte/ki";
  return null;
}
