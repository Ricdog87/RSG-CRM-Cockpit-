import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI } from "@/lib/ai/config";

export class AINotConfigured extends Error {
  constructor() {
    super("Kein KI-Provider verbunden.");
    this.name = "AINotConfigured";
  }
}

/**
 * Ruft das LLM auf und gibt die Roh-Textantwort zurück.
 * Standard: Claude über das offizielle Anthropic-SDK (adaptives Denken).
 * Alternative: OpenRouter (chat/completions).
 */
export async function llmComplete(system: string, user: string): Promise<string> {
  if (AI.provider === "anthropic") {
    const client = new Anthropic({ apiKey: AI.anthropicKey });
    const res = await client.messages.create({
      model: AI.model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  }

  if (AI.provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI.openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter-Fehler ${res.status}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? "";
  }

  throw new AINotConfigured();
}

/**
 * Extrahiert ein JSON-Objekt robust aus der LLM-Antwort
 * (entfernt ggf. Code-Fences / umgebenden Text).
 */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Keine JSON-Antwort vom Modell erhalten.");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}
