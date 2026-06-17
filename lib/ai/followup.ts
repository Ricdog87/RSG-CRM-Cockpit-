import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete, extractJson } from "@/lib/ai/llm";

/**
 * KI-gestützter Follow-up-Entwurf (deutsch, B2B) für einen Kunden. Nutzt den
 * vorhandenen Kontext (Branche, Linie, Status, letzte Notiz, Mandate/Projekte).
 * Ohne KI-Provider → solider Vorlagen-Entwurf.
 */
export interface FollowupInput {
  account: string;
  line: "ki" | "recruiting";
  context: string;
  /** gewünschte Tonalität */
  tone?: "freundlich" | "direkt" | "beratend";
  /** Anlass, z.B. nächste beste Aktion */
  goal?: string;
  /** Absender-Name für die Signatur */
  sender?: string;
}

export interface FollowupDraft {
  subject: string;
  body: string;
  mode: "live" | "demo";
}

const SYSTEM = `Du bist erfahrene:r B2B-Vertriebler:in bei RSG (RSG Recruiting = Personalvermittlung zum Festpreis; RSG AI = KI-Telefonassistenz).
Schreibe eine kurze, professionelle Follow-up-E-Mail auf Deutsch (Sie-Form), die zum Kontext passt und einen klaren nächsten Schritt vorschlägt (z.B. kurzer Call).
Maximal ca. 130 Wörter, kein Bla-Bla, konkret und wertorientiert. Keine erfundenen Fakten.
Antworte AUSSCHLIESSLICH als JSON: { "subject": string, "body": string }. Die Signatur endet mit dem Absender-Namen, falls angegeben.`;

export async function draftFollowup(input: FollowupInput): Promise<FollowupDraft> {
  if (!aiConfigured) return { ...heuristicDraft(input), mode: "demo" };
  try {
    const user = [
      `Kunde: ${input.account}`,
      `Geschäftslinie: ${input.line === "recruiting" ? "RSG Recruiting (Personalvermittlung)" : "RSG AI (KI-Telefonassistenz)"}`,
      `Tonalität: ${input.tone ?? "beratend"}`,
      input.goal ? `Ziel/Anlass: ${input.goal}` : "",
      input.sender ? `Absender: ${input.sender}` : "",
      "",
      "Kontext:",
      input.context || "(kein zusätzlicher Kontext)",
      "",
      "Schreibe den Entwurf als JSON.",
    ]
      .filter(Boolean)
      .join("\n");
    const raw = await llmComplete(SYSTEM, user);
    const p = extractJson<{ subject?: string; body?: string }>(raw);
    const subject = String(p.subject || "").trim();
    const body = String(p.body || "").trim();
    if (!subject || !body) return { ...heuristicDraft(input), mode: "demo" };
    return { subject, body, mode: "live" };
  } catch {
    return { ...heuristicDraft(input), mode: "demo" };
  }
}

function heuristicDraft(input: FollowupInput): { subject: string; body: string } {
  const sig = input.sender ? `\n\nBeste Grüße\n${input.sender}\nRSG` : "\n\nBeste Grüße\nIhr RSG-Team";
  if (input.line === "recruiting") {
    return {
      subject: `Kurzes Update zu Ihrer Vakanz – ${input.account}`,
      body:
        `Guten Tag,\n\nich melde mich kurz zu unserer Zusammenarbeit bei der Personalsuche. ` +
        `Wir haben passende Profile in der Pipeline und möchten die nächsten Schritte mit Ihnen abstimmen.\n\n` +
        `Hätten Sie diese Woche 15 Minuten für einen kurzen Abgleich? Dann priorisieren wir gezielt die Kandidat:innen, die am besten zu Ihnen passen.${sig}`,
    };
  }
  return {
    subject: `Nächste Schritte zu Ihrer KI-Telefonassistenz – ${input.account}`,
    body:
      `Guten Tag,\n\ngerne möchte ich kurz nachfassen, wie wir Ihre Erreichbarkeit mit der KI-Telefonassistenz weiter verbessern können. ` +
      `In einem kurzen Call zeige ich Ihnen konkret, welche Anrufe heute verloren gehen – und wie die Lösung das auffängt.\n\n` +
      `Passt es bei Ihnen diese Woche für 15 Minuten?${sig}`,
  };
}
