import "server-only";
import { AI } from "@/lib/ai/config";

/**
 * Web-gestützte B2B-Recherche via Perplexity (Sonar). Liefert eine knappe,
 * faktische Zusammenfassung zum Unternehmen – oder null, wenn kein Key gesetzt
 * ist bzw. die Anfrage fehlschlägt (dann läuft die Analyse ungeerdet weiter).
 */
export async function webResearch(query: string): Promise<string | null> {
  if (!AI.perplexityKey) return null;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI.perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "Du bist ein präziser B2B-Rechercheur. Antworte knapp, faktenbasiert, auf Deutsch. Nenne Branche, ungefähre Größe, Standort und aktuelle Signale (Wachstum, offene Stellen, Digitalisierungsgrad).",
          },
          { role: "user", content: query },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
