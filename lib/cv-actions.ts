"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { AI } from "@/lib/ai/config";
import { extractJson } from "@/lib/ai/llm";
import { normalizePerson, normalizePhone } from "@/lib/candidate-dedupe";
import { buildSourcingQueries, type SourcingQueries } from "@/lib/sourcing-queries";
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

/** Kombiniert Kontaktdaten + Skills aus einem PDF-CV (ein LLM-Aufruf). */
async function parseCvFull(
  bytes: Uint8Array
): Promise<(CvParsed & { skills: string[] }) | null> {
  if (AI.provider !== "anthropic" || !AI.anthropicKey) return null;
  try {
    const b64 = Buffer.from(bytes).toString("base64");
    const client = new Anthropic({ apiKey: AI.anthropicKey });
    const content: unknown[] = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
      {
        type: "text",
        text:
          'Dies ist ein Lebenslauf. Extrahiere als JSON: {"name": voller Name, ' +
          '"role": aktuelle/angestrebte Position, "email": E-Mail, "phone": Telefon, ' +
          '"skills": Array der wichtigsten Fähigkeiten/Tools/Sprachen/Zertifikate ' +
          '(max 20, kurze Begriffe)}. Fehlt etwas, nutze "" bzw. []. Nur das JSON.',
      },
    ];
    const res = await client.messages.create({
      model: AI.model,
      max_tokens: 1200,
      system: "Du extrahierst strukturierte Daten aus Lebensläufen.",
      messages: [{ role: "user", content: content as unknown as Anthropic.MessageParam["content"] }],
    });
    const block = res.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const j = extractJson<Partial<CvParsed> & { skills?: unknown }>(raw);
    return {
      name: String(j.name ?? "").trim(),
      role: String(j.role ?? "").trim(),
      email: String(j.email ?? "").trim().toLowerCase(),
      phone: String(j.phone ?? "").trim(),
      skills: Array.isArray(j.skills) ? j.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Hängt eine bereits in den Bucket hochgeladene CV-Datei an eine:n BESTEHENDE:N
 * Kandidat:in (Detailseite – nachträglicher Upload/Ersetzen) und füllt dabei
 * fehlende Felder (Position, E-Mail, Telefon, Skills) automatisch aus dem CV.
 * Vorhandene Werte werden NICHT überschrieben. Legt KEINEN neuen Datensatz an.
 */
export async function attachCv(input: {
  candidateId: string;
  cv_path: string;
  cv_filename: string;
}): Promise<ActionResult & { enriched?: string[] }> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const patch: Record<string, unknown> = {
    cv_path: input.cv_path,
    cv_filename: input.cv_filename,
    cv_uploaded_at: new Date().toISOString(),
  };

  // Auto-Ausfüllen: nur leere Felder aus dem PDF-CV ergänzen.
  const enriched: string[] = [];
  if (/\.pdf$/i.test(input.cv_filename)) {
    const { data: cur } = await supabase
      .from("candidates")
      .select("role, email, phone, skills")
      .eq("id", input.candidateId)
      .maybeSingle();
    const c = (cur as { role?: string; email?: string; phone?: string; skills?: unknown } | null) ?? null;
    const { data: file } = await supabase.storage.from(BUCKET).download(input.cv_path);
    if (file) {
      const parsed = await parseCvFull(new Uint8Array(await file.arrayBuffer()));
      if (parsed) {
        if (!c?.role && parsed.role) { patch.role = parsed.role; enriched.push("Position"); }
        if (!c?.email && parsed.email) { patch.email = parsed.email; enriched.push("E-Mail"); }
        if (!c?.phone && parsed.phone) { patch.phone = parsed.phone; enriched.push("Telefon"); }
        const hasSkills = Array.isArray(c?.skills) && (c?.skills as unknown[]).length > 0;
        if (!hasSkills && parsed.skills.length) { patch.skills = parsed.skills; enriched.push("Skills"); }
      }
    }
  }

  const { error: updErr } = await supabase
    .from("candidates")
    .update(patch)
    .eq("id", input.candidateId);
  if (updErr) {
    // skills-Spalte evtl. noch nicht migriert → ohne skills erneut versuchen
    if ("skills" in patch && /column .*skills.* does not exist/i.test(updErr.message)) {
      delete patch.skills;
      const { error: e2 } = await supabase.from("candidates").update(patch).eq("id", input.candidateId);
      if (e2) return { ok: false, error: e2.message };
    } else {
      return { ok: false, error: updErr.message };
    }
  }
  revalidatePath(`/cockpit/kandidaten/${input.candidateId}`);
  return { ok: true, enriched };
}

// ═══════════════════════════════════════════════════════════════════════
// RSG CV Analyser
// Upload → Dublettencheck → Kandidat anlegen/verknüpfen → Felder aus CV
// scrapen → KI-Abgleich mit offenen Such-Mandaten. Kein Treffer →
// Recruiter-Zusammenfassung + Sourcing-Suchstrings (LinkedIn/Indeed/StepStone).
// ═══════════════════════════════════════════════════════════════════════

export interface CvProfile {
  name: string;
  salutation: string;
  title: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  zip: string;
  current_employer: string;
  languages: string;
  experience_years: number | null;
  skills: string[];
  summary: string;
  seniority: string;
  target_roles: string[];
}

export interface MandateHit {
  mandate_id: string;
  account_name: string;
  role: string;
  score: number;
  factors: string[];
}

export interface CvAnalysis {
  ok: boolean;
  error?: string;
  demo?: boolean;
  candidateId?: string;
  /** true = neu angelegt, false = bestehende:r Kandidat:in verknüpft. */
  created?: boolean;
  duplicateOf?: { id: string; name: string; reason: string };
  enriched?: string[];
  profile?: CvProfile;
  matches?: MandateHit[];
  /** Bestes Mandat erreicht die Schwelle (≥ 45). */
  hasMatch?: boolean;
  sourcing?: SourcingQueries;
}

const MATCH_THRESHOLD = 45;

/** Vollständiges Profil + Recruiter-Einschätzung aus einem PDF-CV (ein Call). */
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
          "Dies ist ein Lebenslauf. Analysiere ihn wie ein:e erfahrene:r Personalberater:in " +
          "und extrahiere als JSON: {" +
          '"name": voller Name, "salutation": "Herr"|"Frau"|"", "title": akad. Titel (z.B. Dr.) oder "", ' +
          '"role": aktuelle/angestrebte Position, "email": E-Mail, "phone": Telefon, ' +
          '"location": Wohnort (Stadt), "zip": PLZ, "current_employer": aktueller Arbeitgeber, ' +
          '"languages": Sprachen als kommaseparierter String, "experience_years": Berufsjahre als Zahl (oder null), ' +
          '"skills": Array der wichtigsten Fähigkeiten/Tools/Branchen (max 20, kurze Begriffe), ' +
          '"summary": 2-3 Sätze auf Deutsch: was kann die Person, woher kommt sie, Stärken, ' +
          '"seniority": "Junior"|"Professional"|"Senior"|"Lead"|"Executive", ' +
          '"target_roles": Array 2-4 passender Ziel-Jobtitel/Synonyme für die Suche}. ' +
          'Fehlt etwas, nutze "" bzw. [] bzw. null. Antworte nur mit dem JSON.',
      },
    ];
    const res = await client.messages.create({
      model: AI.model,
      max_tokens: 1600,
      system: "Du bist erfahrene:r Personalberater:in und analysierst Lebensläufe strukturiert.",
      messages: [{ role: "user", content: content as unknown as Anthropic.MessageParam["content"] }],
    });
    const block = res.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const j = extractJson<Record<string, unknown>>(raw);
    const expYears = Number(j.experience_years);
    return {
      name: String(j.name ?? "").trim(),
      salutation: String(j.salutation ?? "").trim(),
      title: String(j.title ?? "").trim(),
      role: String(j.role ?? "").trim(),
      email: String(j.email ?? "").trim().toLowerCase(),
      phone: String(j.phone ?? "").trim(),
      location: String(j.location ?? "").trim(),
      zip: String(j.zip ?? "").trim(),
      current_employer: String(j.current_employer ?? "").trim(),
      languages: String(j.languages ?? "").trim(),
      experience_years: Number.isFinite(expYears) && expYears > 0 ? Math.round(expYears) : null,
      skills: Array.isArray(j.skills) ? j.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [],
      summary: String(j.summary ?? "").trim(),
      seniority: String(j.seniority ?? "").trim(),
      target_roles: Array.isArray(j.target_roles)
        ? j.target_roles.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
        : [],
    };
  } catch {
    return null;
  }
}

function tok(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/** Leichtgewichtiges Scoring Kandidat:in ↔ offenes Mandat (0–100). */
function scoreProfileMandate(
  profile: CvProfile,
  m: { role?: string; job_posting?: string; job_posting_anonymized?: string; ort?: string }
): { score: number; factors: string[] } {
  const factors: string[] = [];
  const candTokens = new Set([
    ...tok(profile.role),
    ...profile.skills.flatMap(tok),
    ...profile.target_roles.flatMap(tok),
  ]);
  const roleTokens = new Set(tok(m.role ?? ""));
  let overlap = 0;
  roleTokens.forEach((t) => { if (candTokens.has(t)) overlap++; });
  const roleScore = roleTokens.size > 0 ? Math.round((overlap / roleTokens.size) * 55) : 18;
  if (roleScore >= 28) factors.push("Rolle passt");

  const posting = `${m.job_posting_anonymized ?? ""} ${m.job_posting ?? ""}`;
  const postTokens = new Set(tok(posting));
  let kw = 0;
  if (postTokens.size) candTokens.forEach((t) => { if (postTokens.has(t)) kw++; });
  const kwScore = Math.min(25, kw * 3);
  if (kwScore >= 9) factors.push("Anzeige-Keywords passen");

  let locScore = 0;
  if (profile.location && m.ort) {
    const a = tok(profile.location);
    const b = new Set(tok(m.ort));
    if (a.some((t) => b.has(t))) { locScore = 20; factors.push("Region passt"); }
  }

  return { score: Math.min(100, roleScore + kwScore + locScore), factors };
}

/**
 * RSG CV Analyser: zentrale Server-Action für den intelligenten CV-Upload.
 */
export async function analyzeCv(input: {
  cv_path: string;
  cv_filename: string;
}): Promise<CvAnalysis> {
  if (useMockData) {
    return {
      ok: true,
      demo: true,
      created: true,
      enriched: ["Position", "Skills"],
      profile: {
        name: "Demo Kandidat", salutation: "", title: "", role: "Senior Category Manager",
        email: "", phone: "", location: "Frankfurt", zip: "", current_employer: "Demo GmbH",
        languages: "Deutsch, Englisch", experience_years: 8,
        skills: ["Category Management", "Einkauf", "FMCG", "Verhandlung"],
        summary: "Demo: erfahrener Category Manager aus dem Handel/FMCG mit Schwerpunkt Einkauf und Sortimentssteuerung.",
        seniority: "Senior", target_roles: ["Category Manager", "Einkaufsleiter"],
      },
      matches: [],
      hasMatch: false,
      sourcing: buildSourcingQueries({
        role: "Senior Category Manager",
        skills: ["Category Management", "Einkauf", "FMCG"],
        location: "Frankfurt",
        targetRoles: ["Category Manager", "Einkaufsleiter"],
      }),
    };
  }
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  // 1) CV laden & analysieren.
  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(input.cv_path);
  if (dlErr || !file) return { ok: false, error: dlErr?.message ?? "CV-Datei nicht gefunden." };
  const bytes = new Uint8Array(await file.arrayBuffer());

  let profile: CvProfile | null = null;
  if (/\.pdf$/i.test(input.cv_filename)) profile = await parseCvProfile(bytes);
  const name = (profile?.name || nameFromFilename(input.cv_filename) || "Unbenannter Kandidat").slice(0, 200);
  const prof: CvProfile = profile ?? {
    name, salutation: "", title: "", role: "", email: "", phone: "", location: "", zip: "",
    current_employer: "", languages: "", experience_years: null, skills: [],
    summary: "", seniority: "", target_roles: [],
  };
  prof.name = name;

  // 2) Dublettencheck gegen bestehende Kandidat:innen.
  const { data: existing } = await supabase
    .from("candidates")
    .select("id, name, email, phone")
    .eq("partner_id", pid);
  const rows = (existing as Array<{ id: string; name: string; email?: string; phone?: string }> | null) ?? [];
  const emailKey = prof.email.toLowerCase().trim();
  const phoneKey = normalizePhone(prof.phone);
  const nameKey = normalizePerson(prof.name);
  let dup: { id: string; name: string; reason: string } | undefined;
  for (const r of rows) {
    if (emailKey && (r.email ?? "").toLowerCase().trim() === emailKey) { dup = { id: r.id, name: r.name, reason: "gleiche E-Mail" }; break; }
    if (phoneKey && normalizePhone(r.phone) === phoneKey) { dup = { id: r.id, name: r.name, reason: "gleiche Telefonnummer" }; break; }
    if (nameKey && normalizePerson(r.name) === nameKey) { dup = { id: r.id, name: r.name, reason: "gleicher Name" }; }
  }

  // 3) Felder schreiben: bei Dublette nur leere Felder ergänzen, sonst neu anlegen.
  const enriched: string[] = [];
  let candidateId: string;
  let created: boolean;

  const fullPatch: Record<string, unknown> = {
    role: prof.role || null,
    email: prof.email || null,
    phone: prof.phone || null,
    location: prof.location || null,
    zip: prof.zip || null,
    salutation: prof.salutation || null,
    title: prof.title || null,
    current_employer: prof.current_employer || null,
    languages: prof.languages || null,
    experience_years: prof.experience_years,
    skills: prof.skills.length ? prof.skills : null,
  };

  if (dup) {
    candidateId = dup.id;
    created = false;
    // Nur leere Felder füllen.
    const { data: cur } = await supabase.from("candidates").select("*").eq("id", dup.id).maybeSingle();
    const c = (cur as Record<string, unknown> | null) ?? {};
    const patch: Record<string, unknown> = { cv_path: input.cv_path, cv_filename: input.cv_filename, cv_uploaded_at: new Date().toISOString() };
    const labels: Record<string, string> = {
      role: "Position", email: "E-Mail", phone: "Telefon", location: "Ort", zip: "PLZ",
      salutation: "Anrede", title: "Titel", current_employer: "Arbeitgeber", languages: "Sprachen",
      experience_years: "Berufsjahre", skills: "Skills",
    };
    for (const [k, v] of Object.entries(fullPatch)) {
      const empty = c[k] == null || c[k] === "" || (Array.isArray(c[k]) && (c[k] as unknown[]).length === 0);
      if (empty && v != null && !(Array.isArray(v) && v.length === 0)) { patch[k] = v; enriched.push(labels[k] ?? k); }
    }
    await updateGracefulCandidate(supabase, dup.id, patch);
  } else {
    created = true;
    const insert: Record<string, unknown> = {
      partner_id: pid, name, source: "CV-Upload", stage: "neu",
      cv_path: input.cv_path, cv_filename: input.cv_filename, cv_uploaded_at: new Date().toISOString(),
      ...fullPatch,
    };
    const ins = await insertGracefulCandidate(supabase, insert);
    if (!ins.id) return { ok: false, error: ins.error ?? "Anlegen fehlgeschlagen." };
    candidateId = ins.id;
    Object.entries(fullPatch).forEach(([k, v]) => {
      if (v != null && !(Array.isArray(v) && v.length === 0)) enriched.push(k);
    });
  }

  // 4) KI-Abgleich mit offenen Mandaten.
  const { data: mandates } = await supabase
    .from("recruiting_mandates")
    .select("id, account_name, role, status, job_posting, job_posting_anonymized")
    .eq("partner_id", pid);
  const mList = (mandates as Array<Record<string, unknown>> | null) ?? [];
  // Account-Orte für Standort-Bonus.
  const { data: accs } = await supabase.from("accounts").select("name, ort").eq("partner_id", pid);
  const ortByAccount = new Map<string, string>();
  for (const a of (accs as Array<{ name?: string; ort?: string }> | null) ?? []) {
    if (a.name) ortByAccount.set(a.name.toLowerCase(), a.ort ?? "");
  }
  const openMandates = mList.filter((m) => {
    const st = String(m.status ?? "");
    return st !== "besetzt" && st !== "angebot";
  });
  const matches: MandateHit[] = openMandates
    .map((m) => {
      const accName = String(m.account_name ?? "");
      const { score, factors } = scoreProfileMandate(prof, {
        role: m.role as string | undefined,
        job_posting: m.job_posting as string | undefined,
        job_posting_anonymized: m.job_posting_anonymized as string | undefined,
        ort: ortByAccount.get(accName.toLowerCase()),
      });
      return { mandate_id: String(m.id), account_name: accName, role: String(m.role ?? ""), score, factors };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const hasMatch = matches.length > 0 && matches[0].score >= MATCH_THRESHOLD;

  // 5) Kein Treffer → Sourcing-Suchstrings beilegen.
  const sourcing = hasMatch
    ? undefined
    : buildSourcingQueries({
        role: prof.role,
        skills: prof.skills,
        location: prof.location,
        targetRoles: prof.target_roles,
      });

  revalidatePath("/cockpit/kandidaten");
  return { ok: true, candidateId, created, duplicateOf: dup, enriched, profile: prof, matches, hasMatch, sourcing };
}

/** candidates-Insert mit Spalten-Stripping (fehlende Spalten werden verworfen). */
async function insertGracefulCandidate(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>
): Promise<{ id?: string; error?: string }> {
  let payload = { ...row };
  for (let i = 0; i < 12; i++) {
    const { data, error } = await supabase.from("candidates").insert(payload).select("id").maybeSingle();
    if (!error && data) return { id: (data as { id: string }).id };
    if (error) {
      const m = /column "([^"]+)" of relation .* does not exist/i.exec(error.message)
        ?? /Could not find the '([^']+)' column/i.exec(error.message);
      if (m && m[1] in payload) { delete payload[m[1]]; continue; }
      return { error: error.message };
    }
    return { error: "Anlegen fehlgeschlagen." };
  }
  return { error: "Anlegen fehlgeschlagen (zu viele fehlende Spalten)." };
}

/** candidates-Update mit Spalten-Stripping. */
async function updateGracefulCandidate(
  supabase: ReturnType<typeof createClient>,
  id: string,
  row: Record<string, unknown>
): Promise<void> {
  let payload = { ...row };
  for (let i = 0; i < 12; i++) {
    const { error } = await supabase.from("candidates").update(payload).eq("id", id);
    if (!error) return;
    const m = /column "([^"]+)" of relation .* does not exist/i.exec(error.message)
      ?? /Could not find the '([^']+)' column/i.exec(error.message);
    if (m && m[1] in payload) { delete payload[m[1]]; continue; }
    return;
  }
}
