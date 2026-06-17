import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete } from "@/lib/ai/llm";
import type { Briefing, BriefingSignal } from "@/lib/ai/briefing";

const SYSTEM = `Du bist der persönliche Sales-Coach im CRM von RSG (RSG Recruiting = Personalvermittlung zum Festpreis, RSG AI = KI-Telefonassistenz).
Du bekommst die wichtigsten Handlungssignale des Tages (bereits priorisiert, mit echten Zahlen).
Formuliere ein kurzes, motivierendes Tages-Briefing auf Deutsch: 2–4 Sätze, direkt, konkret, in der Du-Form.
Beginne mit der wichtigsten Sache. Nenne 1–2 konkrete Zahlen/Namen aus den Signalen. Schließe mit einem klaren Fokus für heute.
Kein Bullet-Listen-Format, keine Floskeln, keine erfundenen Fakten – nur was in den Signalen steht.`;

function signalsToText(signals: BriefingSignal[]): string {
  return signals
    .map((s, i) => `${i + 1}. [${s.severity}/${s.category}] ${s.title} – ${s.detail}. Aktion: ${s.action}`)
    .join("\n");
}

/** Deterministische Zusammenfassung (ohne KI-Provider). */
export function heuristicNarration(b: Briefing): string {
  if (b.signals.length === 0) {
    return "Sauberer Tisch – keine akuten Brennpunkte. Nutze den Freiraum für Kaltakquise und das Füllen deiner Pipeline.";
  }
  const top = b.signals[0];
  const krit = b.counts.kritisch;
  const parts: string[] = [];
  parts.push(
    krit > 0
      ? `${krit} kritische(s) Thema heute – zuerst: ${top.title} (${top.detail}).`
      : `Starte mit: ${top.title} (${top.detail}).`
  );
  if (b.atRisk > 0) {
    parts.push(`Im Blick: rund ${formatEur(b.atRisk)} stehen auf dem Spiel oder zur Entscheidung an.`);
  }
  parts.push("Arbeite die Liste von oben nach unten ab – ein Thema nach dem anderen.");
  return parts.join(" ");
}

export async function narrateBriefing(b: Briefing): Promise<{ text: string; mode: "live" | "demo" }> {
  if (!aiConfigured || b.signals.length === 0) {
    return { text: heuristicNarration(b), mode: "demo" };
  }
  try {
    const user = `Signale (priorisiert):\n${signalsToText(b.signals)}\n\nKritisch: ${b.counts.kritisch}, Wichtig: ${b.counts.wichtig}, Chancen: ${b.counts.chance}. Summe auf dem Spiel: ${formatEur(b.atRisk)}.\n\nSchreibe das Tages-Briefing.`;
    const text = await llmComplete(SYSTEM, user);
    return { text: text.trim() || heuristicNarration(b), mode: "live" };
  } catch {
    return { text: heuristicNarration(b), mode: "demo" };
  }
}

function formatEur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}
