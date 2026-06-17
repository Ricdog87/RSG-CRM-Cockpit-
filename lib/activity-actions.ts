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

  // Wenn ein Kunde zugeordnet ist: zusätzlich als Notiz beim Account ablegen.
  const acc = input.account_name?.trim();
  if (acc) {
    try {
      const { data: a } = await supabase.from("accounts").select("id").ilike("name", acc).maybeSingle();
      const accId = (a as { id?: string } | null)?.id;
      if (accId) {
        const label = input.kind === "call" ? "Anruf" : input.kind === "email" ? "E-Mail" : "Termin";
        const body = `${label} (${input.line === "ki" ? "KI" : "Recruiting"})${input.subject ? `: ${input.subject}` : ""}`;
        await supabase.from("account_notes").insert({ partner_id: pid, account_id: accId, body });
        revalidatePath(`/cockpit/kunden/${accId}`);
      }
    } catch {
      /* Notiz beim Kunden ist optional */
    }
  }

  revalidatePath("/cockpit");
  return { ok: true };
}
