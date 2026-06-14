import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete, extractJson } from "@/lib/ai/llm";
import type { OppScore, OppScoreInput, Priority } from "@/lib/ai/types";

const SYSTEM = `Du bist der Sales-Co-Pilot von RSG (KI-Telefonassistenz "RSG AI" + Personalvermittlung zum Festpreis "RSG Recruiting").
Bewerte eine Verkaufschance für die Priorisierung im Tagesgeschäft einer Vertriebspartner:in.
Berücksichtige Phase, Wahrscheinlichkeit, Wert und Linie. Score 0–100 (Dringlichkeit × Wert × Abschlussnähe).
Nenne GENAU EINE konkrete nächste Aktion (imperativ, deutsch, umsetzbar heute) und eine knappe Begründung.
Antworte AUSSCHLIESSLICH mit JSON in diesem Schema (keine weiteren Felder, kein Text drumherum):
{ "score": number (0-100), "priority": "hoch" | "mittel" | "niedrig", "next_action": string, "reasoning": string }`;

const STAGE_LABEL: Record<string, string> = {
  neu: "Neu",
  qualifiziert: "Qualifiziert",
  demo: "Demo/Termin",
  angebot: "Angebot",
  verhandlung: "Verhandlung",
  gewonnen: "Gewonnen",
};

const STAGE_WEIGHT: Record<string, number> = {
  neu: 5,
  qualifiziert: 15,
  demo: 25,
  angebot: 35,
  verhandlung: 45,
  gewonnen: 50,
};

const STAGE_ACTION: Record<string, string> = {
  neu: "Erstgespräch terminieren und Bedarf qualifizieren",
  qualifiziert: "Produkt-Demo bzw. Vor-Ort-Termin vereinbaren",
  demo: "Angebot erstellen und konkret nachfassen",
  angebot: "Angebot nachverhandeln und Entscheidung einholen",
  verhandlung: "Abschluss terminieren und letzte Einwände ausräumen",
  gewonnen: "Onboarding/Setup starten und Stornorisiko minimieren",
};

function priorityFor(score: number): Priority {
  return score >= 70 ? "hoch" : score >= 45 ? "mittel" : "niedrig";
}

/** Deterministische Heuristik (Demo / Fallback ohne API-Key). */
export function heuristicScore(input: OppScoreInput): OppScore {
  const annual = input.value_type === "mrr" ? input.value * 12 : input.value;
  const valueWeight = annual >= 15000 ? 20 : annual >= 5000 ? 14 : annual >= 1000 ? 8 : 4;
  const stageWeight = STAGE_WEIGHT[input.stage] ?? 5;
  const score = Math.max(
    0,
    Math.min(100, Math.round(input.probability * 0.4 + stageWeight + valueWeight))
  );
  return {
    score,
    priority: priorityFor(score),
    next_action: STAGE_ACTION[input.stage] ?? "Nächsten Kontaktpunkt setzen",
    reasoning: `Phase ${STAGE_LABEL[input.stage] ?? input.stage}, ${input.probability}% Wahrscheinlichkeit, hochgerechneter Jahreswert ~${Math.round(annual)} €.`,
    mode: "demo",
  };
}

/** Bewertet eine Verkaufschance. Ohne API-Key → Heuristik. */
export async function scoreOpportunity(input: OppScoreInput): Promise<OppScore> {
  if (!aiConfigured) return heuristicScore(input);

  const user = `Verkaufschance:
- Account: ${input.account_name}
- Titel: ${input.title}
- Linie: ${input.line === "recruiting" ? "RSG Recruiting (Festpreis 9.999€/Stelle)" : "RSG AI (wiederkehrend)"}
- Phase: ${STAGE_LABEL[input.stage] ?? input.stage}
- Wert: ${input.value} € (${input.value_type === "mrr" ? "monatlich" : "Festpreis"})
- Abschluss-Wahrscheinlichkeit: ${input.probability}%

Bewerte und gib JSON gemäß Schema zurück.`;

  try {
    const raw = await llmComplete(SYSTEM, user);
    const p = extractJson<Partial<OppScore>>(raw);
    const score = Math.max(0, Math.min(100, Math.round(Number(p.score) || 0)));
    return {
      score,
      priority: (["hoch", "mittel", "niedrig"] as Priority[]).includes(
        p.priority as Priority
      )
        ? (p.priority as Priority)
        : priorityFor(score),
      next_action: String(p.next_action || STAGE_ACTION[input.stage] || "Nächsten Schritt setzen"),
      reasoning: String(p.reasoning || ""),
      mode: "live",
    };
  } catch {
    // Bei LLM-/Parsing-Fehler nicht blockieren – Heuristik liefern.
    return heuristicScore(input);
  }
}
