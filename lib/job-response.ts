"use server";

import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { AI } from "@/lib/ai/config";

export type ResponseMode = "interested" | "talentpool" | "declined";
type Resp = { ok: boolean; error?: string; mode?: ResponseMode };

const CONSENT_VERSION = "self-service · stellenlink · v1";
const BUCKET = "candidate-cvs";
const MAX_CV = 8 * 1024 * 1024;

type Mandate = { id: string; partner_id: string; account_name?: string; role?: string };
type Svc = ReturnType<typeof createServiceClient>;

interface CoreInput {
  name: string;
  email: string;
  phone?: string;
  consent: boolean;
  mode: ResponseMode;
  role?: string;
  cvPath?: string;
  cvFilename?: string;
}

// ---------- CV-Parsing (Claude, PDF) --------------------------------

async function parsePdf(
  bytes: Uint8Array
): Promise<{ name: string; role: string; email: string; phone: string } | null> {
  if (AI.provider !== "anthropic" || !AI.anthropicKey) return null;
  try {
    const b64 = Buffer.from(bytes).toString("base64");
    const client = new Anthropic({ apiKey: AI.anthropicKey });
    const res = await client.messages.create({
      model: AI.model,
      max_tokens: 1024,
      system: "Du extrahierst strukturierte Kontaktdaten aus Lebensläufen.",
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
            {
              type: "text",
              text:
                'Lebenslauf. Extrahiere als JSON: {"name":voller Name,"role":aktuelle/angestrebte Position,' +
                '"email":E-Mail,"phone":Telefon}. Fehlt etwas, "". Nur das JSON.',
            },
          ] as unknown as Anthropic.MessageParam["content"],
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const j = JSON.parse(match[0]) as Record<string, unknown>;
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

function nameFromFilename(filename: string): string {
  let base = filename.replace(/\.(pdf|docx?|doc)$/i, "").replace(/\(\d+\)/g, " ").replace(/[_\-]+/g, " ");
  base = base.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\d+/g, " ");
  base = base.replace(/\b(lebenslauf|cv|resume|bewerbung|curriculum|vitae|deutsch|english|englisch|final|neu|aktuell)\b/gi, " ");
  const toks = base.replace(/\s+/g, " ").trim().split(" ").filter((t) => t.length >= 2 && /^[A-Za-zÀ-ÿ'’\-.]+$/.test(t));
  return toks.length >= 2 && toks.length <= 4
    ? toks.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "";
}

// ---------- gemeinsamer Kern -----------------------------------------

async function resolveMandate(supabase: Svc, token: string): Promise<Mandate | null> {
  const { data } = await supabase
    .from("recruiting_mandates")
    .select("id, partner_id, account_name, role")
    .eq("share_token", token)
    .maybeSingle();
  return (data as Mandate | null) ?? null;
}

async function upsertSubmission(supabase: Svc, mandate: Mandate, candidateId: string, stage: string) {
  const { data: sub } = await supabase
    .from("candidate_submissions")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("mandate_id", mandate.id)
    .maybeSingle();
  if ((sub as { id?: string } | null)?.id) {
    await supabase.from("candidate_submissions").update({ stage }).eq("id", (sub as { id: string }).id);
  } else {
    await supabase.from("candidate_submissions").insert({
      partner_id: mandate.partner_id,
      candidate_id: candidateId,
      mandate_id: mandate.id,
      account_name: mandate.account_name ?? null,
      role: mandate.role ?? null,
      stage,
    });
  }
}

async function applyResponse(supabase: Svc, mandate: Mandate, input: CoreInput): Promise<Resp> {
  const { name, email, phone, mode } = input;

  if (mode !== "declined") {
    if (!name) return { ok: false, error: "Bitte Namen angeben (oder CV hochladen)." };
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return { ok: false, error: "Bitte gültige E-Mail angeben (oder CV hochladen)." };
    if (!input.consent) return { ok: false, error: "Bitte die Datenschutz-Einwilligung bestätigen." };
  }

  let candidateId: string | null = null;
  if (email) {
    const { data: existing } = await supabase
      .from("candidates")
      .select("id, cv_path")
      .eq("partner_id", mandate.partner_id)
      .ilike("email", email)
      .maybeSingle();
    candidateId = (existing as { id?: string } | null)?.id ?? null;
    // Bestehende:r ohne CV → CV nachreichen.
    if (candidateId && input.cvPath && !(existing as { cv_path?: string } | null)?.cv_path) {
      await supabase
        .from("candidates")
        .update({ cv_path: input.cvPath, cv_filename: input.cvFilename ?? null, cv_uploaded_at: new Date().toISOString() })
        .eq("id", candidateId);
    }
  }

  if (mode === "declined") {
    if (candidateId) await upsertSubmission(supabase, mandate, candidateId, "abgesagt");
    return { ok: true, mode };
  }

  if (!candidateId) {
    const { data: ins, error: insErr } = await supabase
      .from("candidates")
      .insert({
        partner_id: mandate.partner_id,
        name,
        email,
        phone: phone || null,
        role: input.role || null,
        source: "Stellenlink (Self-Service)",
        mandate_account: mode === "interested" ? mandate.account_name ?? null : null,
        mandate_id: mode === "interested" ? mandate.id : null,
        stage: "neu",
        tags: mode === "talentpool" ? ["Talent-Pool"] : [],
        cv_path: input.cvPath ?? null,
        cv_filename: input.cvFilename ?? null,
        cv_uploaded_at: input.cvPath ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (insErr) return { ok: false, error: "Konnte nicht gespeichert werden." };
    candidateId = (ins as { id: string }).id;

    // Auto-Aufgabe für die/den Recruiter:in – neuer Self-Service-Lead.
    const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const label = mode === "interested" ? "Interessent" : "Talent-Pool-Lead";
    await supabase.from("crm_tasks").insert({
      partner_id: mandate.partner_id,
      related_type: "candidate",
      related_id: candidateId,
      related_label: name,
      title: `Neuer ${label}: ${name} – innerhalb 24 h melden`,
      due_date: due,
    });
  } else if (mode === "interested") {
    await supabase
      .from("candidates")
      .update({ mandate_id: mandate.id, mandate_account: mandate.account_name ?? null })
      .eq("id", candidateId);
  }

  if (candidateId && input.consent) {
    const { data: has } = await supabase
      .from("candidate_consents")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("status", "granted")
      .maybeSingle();
    if (!(has as { id?: string } | null)?.id) {
      await supabase.from("candidate_consents").insert({
        partner_id: mandate.partner_id,
        candidate_id: candidateId,
        token: randomUUID().replace(/-/g, ""),
        status: "granted",
        granted_at: new Date().toISOString(),
        text_version: CONSENT_VERSION,
        email_to: email,
      });
    }
  }

  await upsertSubmission(supabase, mandate, candidateId!, mode === "interested" ? "interessiert" : "talent_pool");
  return { ok: true, mode };
}

// ---------- öffentliche Einstiegspunkte ------------------------------

/** Antwort mit optionalem CV-Upload (FormData: token, mode, name, email, phone, consent, cv). */
export async function submitJobResponse(formData: FormData): Promise<Resp> {
  const token = String(formData.get("token") ?? "");
  const mode = (String(formData.get("mode") ?? "declined") as ResponseMode) ?? "declined";
  let name = String(formData.get("name") ?? "").trim();
  let email = String(formData.get("email") ?? "").trim().toLowerCase();
  let phone = String(formData.get("phone") ?? "").trim();
  const consent = String(formData.get("consent") ?? "") === "1";

  if (!token || !hasServiceRole())
    return { ok: false, error: "Antwort derzeit nicht möglich. Bitte direkt antworten." };

  const supabase = createServiceClient();
  const mandate = await resolveMandate(supabase, token);
  if (!mandate) return { ok: false, error: "Stelle nicht gefunden." };

  let role = "";
  let cvPath: string | undefined;
  let cvFilename: string | undefined;

  const cv = formData.get("cv");
  if (cv instanceof File && cv.size > 0 && mode !== "declined") {
    if (cv.size > MAX_CV) return { ok: false, error: "CV ist zu groß (max. 8 MB)." };
    try {
      const bytes = new Uint8Array(await cv.arrayBuffer());
      const isPdf = /pdf$/i.test(cv.type) || /\.pdf$/i.test(cv.name);
      if (isPdf) {
        const parsed = await parsePdf(bytes);
        if (parsed) {
          if (!name) name = parsed.name;
          if (!email && parsed.email) email = parsed.email;
          if (!phone) phone = parsed.phone;
          role = parsed.role;
        }
      }
      if (!name) name = nameFromFilename(cv.name);

      const ext = (cv.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".pdf").toLowerCase();
      const path = `selfservice/${mandate.partner_id}/${randomUUID()}${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: cv.type || "application/pdf", upsert: false });
      if (!upErr) {
        cvPath = path;
        cvFilename = cv.name;
      }
    } catch {
      /* CV-Verarbeitung darf die Bewerbung nicht blockieren */
    }
  }

  return applyResponse(supabase, mandate, { name, email, phone, consent, mode, role, cvPath, cvFilename });
}
