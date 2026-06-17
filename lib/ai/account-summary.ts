import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete } from "@/lib/ai/llm";

/**
 * Beziehungs-Zusammenfassung: fasst die letzten Kontaktpunkte (Notizen +
 * getrackte E-Mails) eines Kunden zu einem kurzen Status zusammen und schlägt
 * den nächsten Schritt vor. Deterministischer Fallback ohne KI-Provider.
 */
export interface Touchpoint {
  kind: "note" | "email";
  date?: string;
  direction?: "outbound" | "inbound";
  text: string;
}

export interface RelationshipInput {
  account: string;
  line: "ki" | "recruiting";
  touchpoints: Touchpoint[];
}

const SYSTEM = `Du bist CRM-Assistent:in bei RSG. Fasse den Stand der Kundenbeziehung aus den gelieferten Kontaktpunkten (Notizen + E-Mails) zusammen.
Antworte auf Deutsch in 2–3 Sätzen: Wo stehen wir, was war zuletzt das Thema, und was ist der konkrete nächste Schritt?
Nur Fakten aus den Kontaktpunkten verwenden – nichts erfinden.`;

export async function summarizeRelationship(
  input: RelationshipInput
): Promise<{ summary: string; mode: "live" | "demo" }> {
  const tps = input.touchpoints.filter((t) => t.text.trim()).slice(0, 12);
  if (tps.length === 0) {
    return { summary: "Noch keine getrackte Korrespondenz. Erster Kontaktpunkt steht aus – Erstansprache planen.", mode: "demo" };
  }
  if (!aiConfigured) return { summary: heuristic(tps), mode: "demo" };
  try {
    const lines = tps
      .map((t) => `- [${t.kind === "email" ? `E-Mail${t.direction === "inbound" ? " ein" : " aus"}` : "Notiz"}${t.date ? `, ${t.date.slice(0, 10)}` : ""}] ${t.text.slice(0, 300)}`)
      .join("\n");
    const user = `Kunde: ${input.account} (${input.line === "ki" ? "RSG AI" : "RSG Recruiting"})\n\nKontaktpunkte (neueste zuerst):\n${lines}\n\nFasse den Beziehungsstand zusammen.`;
    const text = await llmComplete(SYSTEM, user);
    return { summary: text.trim() || heuristic(tps), mode: "live" };
  } catch {
    return { summary: heuristic(tps), mode: "demo" };
  }
}

function heuristic(tps: Touchpoint[]): string {
  const last = tps[0];
  const count = tps.length;
  const lastLabel = last.kind === "email" ? "E-Mail" : "Notiz";
  return `${count} getrackte Kontaktpunkt(e). Zuletzt (${lastLabel}${last.date ? `, ${last.date.slice(0, 10)}` : ""}): „${last.text.slice(0, 140)}“. Nächster Schritt: am letzten Thema anknüpfen und konkret nachfassen.`;
}
