"use server";

import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { AI, aiConfigured } from "@/lib/ai/config";
import { logDataError } from "@/lib/log";

type Result = { ok: boolean; error?: string; demo?: boolean; text?: string; token?: string };

async function loadMandate(
  id: string
): Promise<{ job_posting?: string; account_name?: string; share_token?: string } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("recruiting_mandates")
    .select("job_posting, account_name, share_token")
    .eq("id", id)
    .maybeSingle();
  return (data as { job_posting?: string; account_name?: string; share_token?: string } | null) ?? null;
}

/** Einfache, KI-freie Notfall-Anonymisierung: Kundenname → neutraler Platzhalter. */
function basicAnonymize(text: string, account?: string): string {
  let out = text;
  if (account) {
    const safe = account.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(safe, "gi"), "unser Mandant");
  }
  return out;
}

/**
 * Anonymisiert die Original-Stellenausschreibung eines Mandats (Kundenbezug
 * entfernen) und speichert das Ergebnis. Nutzt Claude, mit Notfall-Fallback.
 */
export async function anonymizeJobPosting(mandateId: string): Promise<Result> {
  if (useMockData) return { ok: true, demo: true };
  const m = await loadMandate(mandateId);
  if (!m?.job_posting?.trim()) {
    return { ok: false, error: "Keine Original-Stellenausschreibung hinterlegt." };
  }

  let anonymized = "";
  if (aiConfigured && AI.provider === "anthropic" && AI.anthropicKey) {
    try {
      const client = new Anthropic({ apiKey: AI.anthropicKey });
      const res = await client.messages.create({
        model: AI.model,
        max_tokens: 2000,
        system:
          "Du anonymisierst Stellenausschreibungen für eine Personalvermittlung. " +
          "Entferne JEDEN Hinweis auf den konkreten Arbeitgeber: Firmenname, Marken, Logos, " +
          "genaue Adresse, Website, Kontaktdaten, Eigennamen von Personen. " +
          "Ersetze den Arbeitgeber durch neutrale Formulierungen wie „unser Mandant“ oder " +
          "„ein etabliertes Unternehmen“. Behalte Rolle, Aufgaben, Anforderungen, Benefits und " +
          "die grobe Region (z. B. „Raum Frankfurt“) bei. Antworte ausschließlich mit der " +
          "anonymisierten Anzeige als sauberes Markdown, ohne Vorrede.",
        messages: [
          {
            role: "user",
            content: `Arbeitgeber (zu entfernen): ${m.account_name ?? "unbekannt"}\n\nOriginal-Stellenausschreibung:\n\n${m.job_posting}`,
          },
        ],
      });
      const block = res.content.find((b) => b.type === "text");
      anonymized = block && "text" in block ? block.text.trim() : "";
    } catch (e) {
      logDataError("job-posting:anonymize", e);
    }
  }

  if (!anonymized) anonymized = basicAnonymize(m.job_posting, m.account_name);

  const supabase = createClient();
  const { error } = await supabase
    .from("recruiting_mandates")
    .update({ job_posting_anonymized: anonymized })
    .eq("id", mandateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  return { ok: true, text: anonymized };
}

/**
 * Stellt sicher, dass das Mandat einen öffentlichen Teilen-Token hat und gibt
 * ihn zurück (für den Link /stelle/<token>).
 */
export async function ensureShareToken(mandateId: string): Promise<Result> {
  if (useMockData) return { ok: true, demo: true, token: "demo-token" };
  const m = await loadMandate(mandateId);
  if (m?.share_token) return { ok: true, token: m.share_token };

  const token = randomUUID().replace(/-/g, "");
  const supabase = createClient();
  const { error } = await supabase
    .from("recruiting_mandates")
    .update({ share_token: token })
    .eq("id", mandateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  return { ok: true, token };
}
