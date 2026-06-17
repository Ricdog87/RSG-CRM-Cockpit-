"use server";

import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";

type Resp = { ok: boolean; error?: string; interested?: boolean };

/**
 * Öffentliche Bewerber-Antwort über den Stellen-Link (/stelle/<token>).
 * Läuft über den Service-Role-Client (kein Login). „Interessiert" ordnet die
 * Person dem Mandat zu, „Nicht interessiert" protokolliert die Absage.
 */
export async function respondToJob(
  token: string,
  name: string,
  email: string,
  interested: boolean
): Promise<Resp> {
  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanName) return { ok: false, error: "Bitte Namen angeben." };
  if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail))
    return { ok: false, error: "Bitte gültige E-Mail angeben." };
  if (!token || !hasServiceRole())
    return { ok: false, error: "Antwort derzeit nicht möglich. Bitte direkt antworten." };

  try {
    const supabase = createServiceClient();

    // Mandat über den Teilen-Token auflösen.
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
    const { data: existing } = await supabase
      .from("candidates")
      .select("id, mandate_id")
      .eq("partner_id", mandate.partner_id)
      .ilike("email", cleanEmail)
      .maybeSingle();
    let candidateId = (existing as { id?: string } | null)?.id ?? null;

    if (!candidateId) {
      const { data: ins, error: insErr } = await supabase
        .from("candidates")
        .insert({
          partner_id: mandate.partner_id,
          name: cleanName,
          email: cleanEmail,
          source: "Stellenlink",
          mandate_account: mandate.account_name ?? null,
          mandate_id: interested ? mandate.id : null,
          stage: "neu",
        })
        .select("id")
        .single();
      if (insErr) return { ok: false, error: "Konnte nicht gespeichert werden." };
      candidateId = (ins as { id: string }).id;
    } else if (interested) {
      // Interesse ⇒ dem Mandat zuordnen.
      await supabase
        .from("candidates")
        .update({ mandate_id: mandate.id, mandate_account: mandate.account_name ?? null })
        .eq("id", candidateId);
    }

    // Vorstellung/Antwort protokollieren (Duplikat je Mandat vermeiden).
    const stage = interested ? "interessiert" : "abgesagt";
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

    return { ok: true, interested };
  } catch {
    return { ok: false, error: "Etwas ist schiefgelaufen. Bitte später erneut versuchen." };
  }
}
