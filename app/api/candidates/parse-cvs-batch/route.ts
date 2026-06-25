import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { AI } from "@/lib/ai/config";
import { extractJson } from "@/lib/ai/llm";

/**
 * Batch-CV-Parsing: reichert Kandidat:innen mit strukturierten Match-Feldern
 * (skills, location, seniority, experience_years, languages, ...) aus dem
 * hinterlegten PDF-CV an. Enrich-only: ueberschreibt KEINE vorhandenen Werte,
 * setzt nur leere Felder + Marker cv_parsed_at.
 *
 * Zwei Pfade (analog /api/hubspot/sync-projects):
 *  - Partner-Session: ohne Header -> nur eigene Kandidat:innen.
 *  - Cron/n8n: Header x-sync-secret = SYNC_CRON_SECRET -> alle Partner (Service-Role).
 *
 * Chunked + idempotent: pro Aufruf bis CHUNK CVs, Zeitbudget-begrenzt; pro
 * Kandidat:in wird cv_parsed_at sofort gesetzt -> Wiederaufruf macht weiter.
 * Antwort: { ok, processed, remaining }. Wiederholt aufrufen, bis remaining = 0.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "candidate-cvs";
const CHUNK = 8;
const TIME_BUDGET_MS = 50_000;
const PARSE_MODEL = process.env.CV_PARSE_MODEL || "claude-haiku-4-5-20251001";

interface CvProfile {
  role: string;
  email: string;
  phone: string;
  location: string;
  zip: string;
  current_employer: string;
  languages: string;
  experience_years: number | null;
  skills: string[];
  seniority: string;
}

async function parseCvProfile(bytes: Uint8Array): Promise<CvProfile | null> {
  if (AI.provider !== "anthropic" || !AI.anthropicKey) return null;
  try {
    const b64 = Buffer.from(bytes).toString("base64");
    const client = new Anthropic({ apiKey: AI.anthropicKey });
    const content: unknown[] = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
      {
        type: "text",
        text:
          "Dies ist ein Lebenslauf. Extrahiere als JSON: {" +
          '"role": aktuelle/angestrebte Position, "email": E-Mail, "phone": Telefon, ' +
          '"location": Wohnort (Stadt), "zip": PLZ, "current_employer": aktueller Arbeitgeber, ' +
          '"languages": Sprachen als kommaseparierter String, "experience_years": Berufsjahre als Zahl oder null, ' +
          '"skills": Array der wichtigsten Faehigkeiten/Tools/Branchen (max 20, kurze Begriffe), ' +
          '"seniority": "Junior"|"Professional"|"Senior"|"Lead"|"Executive"}. ' +
          'Fehlt etwas, nutze "" bzw. [] bzw. null. Antworte nur mit dem JSON.',
      },
    ];
    const res = await client.messages.create({
      model: PARSE_MODEL,
      max_tokens: 1200,
      system: "Du extrahierst strukturierte Daten aus Lebenslaeufen.",
      messages: [{ role: "user", content: content as unknown as Anthropic.MessageParam["content"] }],
    });
    const block = res.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const j = extractJson<Record<string, unknown>>(raw);
    const expYears = Number(j.experience_years);
    return {
      role: String(j.role ?? "").trim(),
      email: String(j.email ?? "").trim().toLowerCase(),
      phone: String(j.phone ?? "").trim(),
      location: String(j.location ?? "").trim(),
      zip: String(j.zip ?? "").trim(),
      current_employer: String(j.current_employer ?? "").trim(),
      languages: String(j.languages ?? "").trim(),
      experience_years: Number.isFinite(expYears) && expYears > 0 ? Math.round(expYears) : null,
      skills: Array.isArray(j.skills) ? j.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [],
      seniority: String(j.seniority ?? "").trim(),
    };
  } catch {
    return null;
  }
}

type Sb = ReturnType<typeof createServiceClient>;

interface CandRow {
  id: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  zip: string | null;
  current_employer: string | null;
  languages: string | null;
  experience_years: number | null;
  seniority: string | null;
  skills: string[] | null;
  cv_path: string | null;
  cv_filename: string | null;
}

const SELECT_COLS =
  "id, role, email, phone, location, zip, current_employer, languages, experience_years, seniority, skills, cv_path, cv_filename";

async function processPartner(client: Sb, partnerId: string, startedAt: number): Promise<number> {
  const { data } = await client
    .from("candidates")
    .select(SELECT_COLS)
    .eq("partner_id", partnerId)
    .not("cv_path", "is", null)
    .is("cv_parsed_at", null)
    .ilike("cv_filename", "%.pdf")
    .limit(CHUNK);
  const rows = (data as CandRow[] | null) ?? [];
  let processed = 0;
  for (const c of rows) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    const patch: Record<string, unknown> = { cv_parsed_at: new Date().toISOString() };
    try {
      if (c.cv_path) {
        const { data: file } = await client.storage.from(BUCKET).download(c.cv_path);
        if (file) {
          const p = await parseCvProfile(new Uint8Array(await file.arrayBuffer()));
          if (p) {
            if (!c.role && p.role) patch.role = p.role;
            if (!c.email && p.email) patch.email = p.email;
            if (!c.phone && p.phone) patch.phone = p.phone;
            if (!c.location && p.location) patch.location = p.location;
            if (!c.zip && p.zip) patch.zip = p.zip;
            if (!c.current_employer && p.current_employer) patch.current_employer = p.current_employer;
            if (!c.languages && p.languages) patch.languages = p.languages;
            if (c.experience_years == null && p.experience_years != null) patch.experience_years = p.experience_years;
            if (!c.seniority && p.seniority) patch.seniority = p.seniority;
            if ((!c.skills || c.skills.length === 0) && p.skills.length) patch.skills = p.skills;
          }
        }
      }
    } catch {
      // Einzelfehler darf den Batch nicht stoppen; Marker wird dennoch gesetzt.
    }
    await client.from("candidates").update(patch).eq("id", c.id).eq("partner_id", partnerId);
    processed++;
  }
  return processed;
}

async function countRemaining(client: Sb, partnerId: string): Promise<number> {
  const { count } = await client
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .not("cv_path", "is", null)
    .is("cv_parsed_at", null)
    .ilike("cv_filename", "%.pdf");
  return count ?? 0;
}

async function currentPartnerId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("partners").select("id").eq("auth_user_id", user.id).single();
  return data ? (data.id as string) : null;
}

export async function POST() {
  if (AI.provider !== "anthropic" || !AI.anthropicKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY nicht gesetzt." }, { status: 500 });
  }
  const startedAt = Date.now();
  const secret = process.env.SYNC_CRON_SECRET;
  const provided = headers().get("x-sync-secret");
  const isCron = Boolean(secret) && provided === secret;

  let processed = 0;
  let remaining = 0;

  if (isCron) {
    if (!hasServiceRole()) {
      return NextResponse.json(
        { ok: false, error: "Service-Role nicht verfuegbar (SUPABASE_SERVICE_ROLE_KEY fehlt)." },
        { status: 500 }
      );
    }
    const svc = createServiceClient();
    const { data: partners } = await svc.from("partners").select("id");
    const plist = (partners as { id: string }[] | null) ?? [];
    for (const p of plist) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      processed += await processPartner(svc, p.id, startedAt);
    }
    for (const p of plist) {
      remaining += await countRemaining(svc, p.id);
    }
  } else {
    const pid = await currentPartnerId();
    if (!pid) return NextResponse.json({ ok: false, error: "Keine aktive Partner-Session." }, { status: 401 });
    const supabase = createClient() as unknown as Sb;
    processed = await processPartner(supabase, pid, startedAt);
    remaining = await countRemaining(supabase, pid);
  }

  return NextResponse.json({ ok: true, processed, remaining }, { headers: { "Cache-Control": "no-store" } });
}
