"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";

const DEMO: ActionResult = { ok: true, demo: true };

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

export interface ActivityInput {
  kind: "call" | "email" | "meeting";
  line: "ki" | "recruiting";
  subject?: string;
  account_name?: string;
  /** Nur für Kaltakquise-Neukunden: gehen in den neuen Account. */
  contact_name?: string;
  contact_phone?: string;
}

/**
 * Loggt eine Aktivität (Call/E-Mail) für die Tagesziele & den Wochenfokus.
 * Optional mit Kundenbezug → erscheint auch in der Kunden-Korrespondenz.
 */
export async function logActivity(input: ActivityInput): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { error: insErr } = await supabase.from("activity_log").insert({
    partner_id: pid,
    kind: input.kind,
    line: input.line,
    subject: input.subject?.trim() || null,
    account_name: input.account_name?.trim() || null,
  });
  if (insErr) {
    if (/relation .*activity_log.* does not exist/i.test(insErr.message))
      return { ok: false, error: "Tabelle activity_log fehlt – Migration 25 ausführen." };
    return { ok: false, error: insErr.message };
  }

  // Kundenbezug: bei vorhandenem Account Notiz ablegen – sonst (Kaltakquise)
  // den Kunden direkt als Lead anlegen und die Korrespondenz hinterlegen.
  const acc = input.account_name?.trim();
  if (acc) {
    try {
      const { data: a } = await supabase.from("accounts").select("id").ilike("name", acc).maybeSingle();
      let accId = (a as { id?: string } | null)?.id;

      if (!accId) {
        const row: Record<string, unknown> = {
          partner_id: pid,
          name: acc,
          line: input.line,
          lifecycle: "lead",
          mrr: 0,
          contact_name: input.contact_name?.trim() || null,
          contact_phone: input.contact_phone?.trim() || null,
        };
        // Graceful: noch nicht migrierte Spalten (z.B. contact_phone) weglassen.
        let ins: { id?: string } | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const res = await supabase.from("accounts").insert(row).select("id").single();
          if (!res.error) {
            ins = res.data as { id?: string };
            break;
          }
          const m = res.error.message.match(/column "?([a-z_]+)"? .*does not exist/i);
          if (m && m[1] in row) {
            delete row[m[1]];
            continue;
          }
          break;
        }
        accId = ins?.id;
        revalidatePath("/cockpit/kunden");
      }

      if (accId) {
        const label = input.kind === "call" ? "Anruf" : input.kind === "email" ? "E-Mail" : "Termin";
        const body = `${label} (${input.line === "ki" ? "KI" : "Recruiting"})${input.subject ? `: ${input.subject}` : ""}`;
        await supabase.from("account_notes").insert({ partner_id: pid, account_id: accId, body });
        revalidatePath(`/cockpit/kunden/${accId}`);
      }
    } catch {
      /* Kundenanlage/Notiz ist best-effort und darf das Logging nicht blockieren */
    }
  }

  revalidatePath("/cockpit");
  return { ok: true };
}
