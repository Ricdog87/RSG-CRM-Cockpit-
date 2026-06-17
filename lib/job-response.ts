"use server";

import { randomUUID } from "crypto";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";

export type ResponseMode = "interested" | "talentpool" | "declined";
type Resp = { ok: boolean; error?: string; mode?: ResponseMode };

export interface JobResponseInput {
  name: string;
  email: string;
  phone?: string;
  consent: boolean;
  mode: ResponseMode;
}

const CONSENT_VERSION = "self-service · stellenlink · v1";

/**
 * Öffentliche Bewerber-Antwort über den Stellen-Link (/stelle/<token>).
 * - interested  → dem Mandat zuordnen (+ Self-Service-Anlage mit Einwilligung)
 * - talentpool  → kein Interesse an DIESER Stelle, aber für künftige vormerken
 * - declined    → reine Absage (nur protokolliert, wenn bereits bekannt)
 * Läuft über den Service-Role-Client (kein Login).
 */
export async function respondToJob(token: string, input: JobResponseInput): Promise<Resp> {
  const name = (input.name || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").trim();
  const mode = input.mode;

  if (mode !== "declined") {
    if (!name) return { ok: false, error: "Bitte Namen angeben." };
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return { ok: false, error: "Bitte gültige E-Mail angeben." };
    if (!input.consent) return { ok: false, error: "Bitte die Datenschutz-Einwilligung bestätigen." };
  }
  if (!token || !hasServiceRole())
    return { ok: false, error: "Antwort derzeit nicht möglich. Bitte direkt antworten." };

  try {
    const supabase = createServiceClient();

    const { data: m } = await supabase
      .from("recruiting_mandates")
      .select("id, partner_id, account_name, role")
      .eq("share_token", token)
      .maybeSingle();
    const mandate = m as
      | { id: string; partner_id: string; account_name?: string; role?: string }
      | null;
    if (!mandate) return { ok: false, error: "Stelle nicht gefunden." };

    // Bestehende:n Kandidat:in per E-Mail im selben Partner-Konto finden.
    let candidateId: string | null = null;
    if (email) {
      const { data: existing } = await supabase
        .from("candidates")
        .select("id")
        .eq("partner_id", mandate.partner_id)
        .ilike("email", email)
        .maybeSingle();
      candidateId = (existing as { id?: string } | null)?.id ?? null;
    }

    // Reine Absage ohne Einwilligung: nur protokollieren, wenn schon bekannt.
    if (mode === "declined") {
      if (candidateId) await upsertSubmission(supabase, mandate, candidateId, "abgesagt");
      return { ok: true, mode };
    }

    // Self-Service-Anlage / Aktualisierung.
    const isNew = !candidateId;
    if (isNew) {
      const { data: ins, error: insErr } = await supabase
        .from("candidates")
        .insert({
          partner_id: mandate.partner_id,
          name,
          email,
          phone: phone || null,
          source: "Stellenlink (Self-Service)",
          mandate_account: mode === "interested" ? mandate.account_name ?? null : null,
          mandate_id: mode === "interested" ? mandate.id : null,
          stage: "neu",
          tags: mode === "talentpool" ? ["Talent-Pool"] : [],
        })
        .select("id")
        .single();
      if (insErr) return { ok: false, error: "Konnte nicht gespeichert werden." };
      candidateId = (ins as { id: string }).id;
    } else if (mode === "interested") {
      await supabase
        .from("candidates")
        .update({ mandate_id: mandate.id, mandate_account: mandate.account_name ?? null })
        .eq("id", candidateId);
    }

    // Einwilligung dokumentieren (granted), Duplikat vermeiden.
    if (candidateId && input.consent) {
      const { data: hasConsent } = await supabase
        .from("candidate_consents")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("status", "granted")
        .maybeSingle();
      if (!(hasConsent as { id?: string } | null)?.id) {
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

    await upsertSubmission(
      supabase,
      mandate,
      candidateId!,
      mode === "interested" ? "interessiert" : "talent_pool"
    );

    return { ok: true, mode };
  } catch {
    return { ok: false, error: "Etwas ist schiefgelaufen. Bitte später erneut versuchen." };
  }
}

async function upsertSubmission(
  supabase: ReturnType<typeof createServiceClient>,
  mandate: { id: string; partner_id: string; account_name?: string; role?: string },
  candidateId: string,
  stage: string
) {
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
