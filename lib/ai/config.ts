/**
 * Konfiguration der KI-Schicht. Alle Keys nur serverseitig (ENV) – niemals
 * im Browser. Provider-Reihenfolge: Anthropic (Claude, Standard) → OpenRouter.
 * Perplexity ist optional und dient der web-gestützten Recherche.
 */
type Provider = "anthropic" | "openrouter" | "none";

const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";
const perplexityKey = process.env.PERPLEXITY_API_KEY ?? "";

function resolveProvider(): Provider {
  if (anthropicKey) return "anthropic";
  if (openrouterKey) return "openrouter";
  return "none";
}

const provider = resolveProvider();

// Standardmodell: Claude Opus 4.8 (smartestes Modell). Über OpenRouter mit
// Provider-Präfix. Per AI_MODEL überschreibbar.
const defaultModel =
  provider === "openrouter" ? "anthropic/claude-opus-4-8" : "claude-opus-4-8";

export const AI = {
  provider,
  model: process.env.AI_MODEL || defaultModel,
  anthropicKey,
  openrouterKey,
  perplexityKey,
} as const;

/** true ⇒ ein LLM-Provider ist verbunden (echte Analysen möglich) */
export const aiConfigured = provider !== "none";

/** true ⇒ web-gestützte Recherche via Perplexity verfügbar */
export const webResearchEnabled = perplexityKey.length > 0;
