"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { AI } from "@/lib/ai/config";
import { extractJson } from "@/lib/ai/llm";
import type { ActionResult } from "@/lib/crm-actions";

/**
 * Server Actions für den CV-Upload der Recruiting-Pipeline.
 * Der Browser lädt die Datei mit ANON-Key + User-Session in den privaten
 * Storage-Bucket `candidate-cvs` (RLS: nur authenticated). Anschließend liest
 * diese Action die Datei serverseitig, extrahiert per Claude die Kerndaten
 * (Name, Position, E-Mail, Telefon) und legt RLS-konform eine:n Kandidat:in an.
 * Kein Service-Role-Key im Spiel – alles über die normale User-Session.
 */
const BUCKET = "candidate-cvs";

async function currentPartnerId(): Promise<{ id: string | null; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Keine aktive Session." };
  const { data, error } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) return { id: null, error: "Kein Partner-Profil gefunden." };
  return { id: data.id as string };
}

export interface CvParsed {
  name: string;
  role: string;
  email: string;
  phone: string;
}

/** Notnagel: plausiblen Namen aus dem Dateinamen ableiten. */
function nameFromFilename(filename: string): string {
  let base = filename.replace(/\.(pdf|docx?|doc)$/i, "");
  base = base.replace(/\(\d+\)/g, " ").replace(/[_\-]+/g, " ");
  base = base.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\d+/g, " ");
  base = base.replace(
    /\b(lebenslauf|cv|resume|bewerbung|bewerbungsunterlagen|curriculum|vitae|deutsch|english|englisch|en|de|final|neu|aktuell|version)\b/gi,
    " "
  );
  base = base.replace(/\s+/g, " ").trim();
  const toks = base
    .split(" ")
    .filter((t) => t.length >= 2 && /^[A-Za-zÀ-ÿ'’\-.]+$/.test(t));
  if (toks.length >= 2 && toks.length <= 4) {
    return toks.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return "";
}

/** PDF an Claude geben und {name, role, email, phone} als JSON extrahieren. */
async function parsePdfWithClaude(bytes: Uint8Array): Promise<CvParsed | null> {
  if (AI.provider !== "anthropic" || !AI.anthropicKey) return null;
  try {
    const b64 = Buffer.from(bytes).toString("base64");
    const client = new Anthropic({ apiKey: AI.anthropicKey });
    const content: unknown[] = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: b64 },
      },
      {
        type: "text",
        text:
          'Dies ist ein Lebenslauf. Extrahiere als kompaktes JSON: ' +
          '{"name": voller Name der Person, "role": aktuelle oder angestrebte ' +
          'Position/Berufsbezeichnung, "email": E-Mail-Adresse, "phone": ' +
          'Telefonnummer}. Fehlt ein Feld, nutze "". Antworte nur mit dem JSON.',
      },
    ];
    const res = await client.messages.create({
      model: AI.model,
      max_tokens: 1024,
      system: "Du extrahierst strukturierte Kontaktdaten aus Lebensläufen.",
      messages: [{ role: "user", content: content as unknown as Anthropic.MessageParam["content"] }],
    });
    const block = res.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const j = extractJson<Partial<CvParsed>>(raw);
    return {
      name: String(j.name ?? "").trim(),
      role: String(j.role ?? "").trim(),
      email: String(j.email ?? "").trim().toLowerCase(),
      phone: String(j.phone ?? "").trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Legt aus einer bereits in den Bucket hochgeladenen CV-Datei eine:n
 * Kandidat:in an (inkl. automatisch extrahierter Kerndaten).
 */
export async function ingestCv(input: {
  cv_path: string;
  cv_filename: string;
}): Promise<ActionResult & { candidate?: CvParsed }> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { data: file, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(input.cv_path);
  if (dlErr || !file) {
    return { ok: false, error: dlErr?.message ?? "CV-Datei nicht gefunden." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());

  let parsed: CvParsed | null = null;
  if (/\.pdf$/i.test(input.cv_filename)) parsed = await parsePdfWithClaude(bytes);

  const cand: CvParsed = {
    name: (parsed?.name || nameFromFilename(input.cv_filename) || "Unbenannter Kandidat").slice(0, 200),
    role: parsed?.role || "",
    email: parsed?.email || "",
    phone: parsed?.phone || "",
  };

  const { error: insErr } = await supabase.from("candidates").insert({
    partner_id: pid,
    name: cand.name,
    role: cand.role || null,
    email: cand.email || null,
    phone: cand.phone || null,
    source: "CV-Upload",
    stage: "neu",
    cv_path: input.cv_path,
    cv_filename: input.cv_filename,
    cv_uploaded_at: new Date().toISOString(),
  });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath("/cockpit/kandidaten");
  return { ok: true, candidate: cand };
}

/** Erzeugt einen kurzlebigen, signierten Download-Link für eine CV-Datei. */
export async function cvSignedUrl(
  path: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (useMockData) return { ok: false, error: "Demo-Modus – keine Datei verknüpft." };
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data) return { ok: false, error: error?.message ?? "Link konnte nicht erzeugt werden." };
  return { ok: true, url: data.signedUrl };
}

/** PDF an Claude geben und ein Skill-Set (Liste) extrahieren. */
async function parseSkillsWithClaude(bytes: Uint8Array): Promise<string[] | null> {
  if (AI.provider !== "anthropic" || !AI.anthropicKey) return null;
  try {
    const b64 = Buffer.from(bytes).toString("base64");
    const client = new Anthropic({ apiKey: AI.anthropicKey });
    const content: unknown[] = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: b64 },
      },
      {
        type: "text",
        text:
          "Dies ist ein Lebenslauf. Extrahiere die wichtigsten fachlichen " +
          "Fähigkeiten/Kompetenzen (Skills, Tools, Sprachen, Zertifikate) als " +
          'JSON-Array kurzer Begriffe, z.B. {"skills": ["SAP", "Englisch C1", ' +
          '"Projektleitung"]}. Maximal 20, keine ganzen Sätze. Antworte nur mit dem JSON.',
      },
    ];
    const res = await client.messages.create({
      model: AI.model,
      max_tokens: 1024,
      system: "Du extrahierst strukturierte Skill-Listen aus Lebensläufen.",
      messages: [{ role: "user", content: content as unknown as Anthropic.MessageParam["content"] }],
    });
    const block = res.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const j = extractJson<{ skills?: unknown }>(raw);
    if (!Array.isArray(j.skills)) return [];
    return j.skills
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return null;
  }
}

/**
 * Extrahiert die Skills aus dem hinterlegten CV einer:s Kandidat:in (Claude)
 * und speichert sie in candidates.skills. Setzt die Migration
 * 02_candidate_skills.sql voraus.
 */
export async function extractCandidateSkills(
  id: string
): Promise<ActionResult & { skills?: string[] }> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { data: cand, error: selErr } = await supabase
    .from("candidates")
    .select("cv_path, cv_filename")
    .eq("id", id)
    .maybeSingle();
  if (selErr || !cand) return { ok: false, error: selErr?.message ?? "Kandidat:in nicht gefunden." };
  const cvPath = (cand as { cv_path?: string }).cv_path;
  const cvName = (cand as { cv_filename?: string }).cv_filename ?? "";
  if (!cvPath) return { ok: false, error: "Kein CV hinterlegt." };
  if (!/\.pdf$/i.test(cvName)) {
    return { ok: false, error: "Skill-Extraktion derzeit nur für PDF-Lebensläufe." };
  }

  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(cvPath);
  if (dlErr || !file) return { ok: false, error: dlErr?.message ?? "CV-Datei nicht gefunden." };

  const skills = await parseSkillsWithClaude(new Uint8Array(await file.arrayBuffer()));
  if (skills == null) {
    return { ok: false, error: "KI nicht verbunden (ANTHROPIC_API_KEY fehlt)." };
  }

  const { error: updErr } = await supabase
    .from("candidates")
    .update({ skills })
    .eq("id", id);
  if (updErr) {
    if (/column .*skills.* does not exist/i.test(updErr.message)) {
      return { ok: false, error: "Spalte `skills` fehlt – Migration 02_candidate_skills.sql ausführen." };
    }
    return { ok: false, error: updErr.message };
  }
  revalidatePath(`/cockpit/kandidaten/${id}`);
  return { ok: true, skills };
}

/**
 * Hängt eine bereits in den Bucket hochgeladene CV-Datei an eine:n BESTEHENDE:N
 * Kandidat:in (Detailseite – nachträglicher Upload/Ersetzen). Aktualisiert
 * cv_path/cv_filename/cv_uploaded_at; legt KEINEN neuen Datensatz an.
 */
export async function attachCv(input: {
  candidateId: string;
  cv_path: string;
  cv_filename: string;
}): Promise<ActionResult> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: updErr } = await supabase
    .from("candidates")
    .update({
      cv_path: input.cv_path,
      cv_filename: input.cv_filename,
      cv_uploaded_at: new Date().toISOString(),
    })
    .eq("id", input.candidateId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath(`/cockpit/kandidaten/${input.candidateId}`);
  return { ok: true };
}
