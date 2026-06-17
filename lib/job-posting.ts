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

const RSG_EMAIL = "bewerbung@recruiting-sg.de";

/**
 * Deterministische Bereinigung (Sicherheitsnetz, auch ohne KI): entfernt
 * E-Mails (→ Standard-Bewerbungsadresse), URLs/Links, Telefonnummern,
 * den Kundennamen samt einzelner Namensbestandteile.
 */
function scrubText(text: string, account?: string): string {
  let out = text;

  // Kundenname + signifikante Bestandteile (z.B. „Lagardère") → neutral.
  if (account) {
    const safe = account.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(safe, "gi"), "unser Mandant");
    for (const tok of account.split(/\s+/).filter((t) => t.replace(/[^a-zà-ÿ]/gi, "").length >= 4)) {
      const safeTok = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\b${safeTok}\\b`, "gi"), "unser Mandant");
    }
  }

  // E-Mails → Standard-Bewerbungsadresse von RSG.
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, RSG_EMAIL);
  // URLs / Links entfernen.
  out = out.replace(/https?:\/\/\S+/gi, "").replace(/\bwww\.[^\s)]+/gi, "");
  // Telefonnummern grob entfernen.
  out = out.replace(/(?:tel\.?|telefon|mobil|fon)[:\s]*\+?[\d\s()./-]{6,}\d/gi, "");
  out = out.replace(/\+?\d[\d\s()./-]{7,}\d/g, "");

  // Aufräumen: leere „Kontakt-Reste", mehrfach-Leerzeilen.
  out = out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
          "Entferne RIGOROS JEDEN Hinweis auf den konkreten Arbeitgeber: Firmenname, " +
          "Tochterfirmen, Marken-/Store-/Produktnamen, Logos, genaue Adresse, Website, " +
          "Social-Media-/Video-Links, konkrete Kennzahlen, die das Unternehmen identifizieren " +
          "(z.B. „über 5.000 Stores in 39 Ländern“), sowie ALLE Kontaktdaten und " +
          "Ansprechpartner-Namen (z.B. „Frau Ina Wilhelm“). " +
          "Entferne auch den kompletten Bewerbungs-/Kontakt-Abschnitt (E-Mail, Telefon, „sende an …“). " +
          "Ersetze den Arbeitgeber durch neutrale Formulierungen wie „unser Mandant“ oder " +
          "„ein etabliertes Unternehmen“. Behalte Rolle, Aufgaben, Anforderungen, Benefits und " +
          "die grobe Region (z. B. „Raum Frankfurt“) bei. " +
          "Falls eine Bewerbungsmöglichkeit nötig ist, nenne ausschließlich „bewerbung@recruiting-sg.de“. " +
          "Antworte ausschließlich mit der anonymisierten Anzeige als sauberes Markdown, ohne Vorrede.",
        messages: [
          {
            role: "user",
            content: `Arbeitgeber (vollständig entfernen, inkl. Marken & Ansprechpartner): ${m.account_name ?? "unbekannt"}\n\nOriginal-Stellenausschreibung:\n\n${m.job_posting}`,
          },
        ],
      });
      const block = res.content.find((b) => b.type === "text");
      anonymized = block && "text" in block ? block.text.trim() : "";
    } catch (e) {
      logDataError("job-posting:anonymize", e);
    }
  }

  if (!anonymized) anonymized = m.job_posting;

  // Deterministisches Sicherheitsnetz – greift auch, wenn die KI etwas übersieht
  // oder kein KI-Key gesetzt ist.
  anonymized = scrubText(anonymized, m.account_name);
  // Einheitlicher Bewerbungs-Hinweis (keine Kundendaten).
  if (!anonymized.includes(RSG_EMAIL)) {
    anonymized += `\n\n— \nInteresse? Direkt über diesen Link melden – oder ${RSG_EMAIL}. Die Betreuung erfolgt vertraulich über RSG Recruiting.`;
  }

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
