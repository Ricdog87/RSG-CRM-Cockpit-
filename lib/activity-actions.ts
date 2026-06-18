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
  /** Wiedervorlage in X Tagen anlegen (0 = keine). */
  followupDays?: number;
}

/**
 * Loggt eine Aktivität (Call/E-Mail) für die Tagesziele & den Wochenfokus.
 * Mit Kundenbezug → Korrespondenz beim Kunden (bestehend oder neu als Lead).
 * Optional: Wiedervorlage-Aufgabe.
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

  // Kundenbezug: bestehenden Account finden oder (Kaltakquise) neu als Lead anlegen.
  const acc = input.account_name?.trim();
  let accId: string | undefined;
  let warning: string | undefined;

  if (acc) {
    const { data: a } = await supabase.from("accounts").select("id").ilike("name", acc).limit(1);
    accId = (a as Array<{ id?: string }> | null)?.[0]?.id;

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
      let lastErr = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await supabase.from("accounts").insert(row).select("id").single();
        if (!res.error) {
          accId = (res.data as { id?: string } | null)?.id;
          break;
        }
        lastErr = res.error.message;
        const m = res.error.message.match(/column "?([a-z_]+)"? .*does not exist/i);
        if (m && m[1] in row) {
          delete row[m[1]];
          continue;
        }
        break;
      }
      if (!accId) warning = `Aktivität gespeichert, aber Neukunde „${acc}" konnte nicht angelegt werden: ${lastErr}`;
      else revalidatePath("/cockpit/kunden");
    }

    if (accId) {
      const label = input.kind === "call" ? "Anruf" : input.kind === "email" ? "E-Mail" : "Termin";
      const body = `${label} (${input.line === "ki" ? "KI" : "Recruiting"})${input.subject ? `: ${input.subject}` : ""}`;
      await supabase.from("account_notes").insert({ partner_id: pid, account_id: accId, body });
      // Letzte Aktivität aktualisieren (für Health-Score & Briefing); graceful,
      // falls die Spalte fehlt – blockiert nie.
      await supabase
        .from("accounts")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", accId);
      revalidatePath(`/cockpit/kunden/${accId}`);
    }
  }

  // Wiedervorlage / Nachfass-Aufgabe.
  const days = input.followupDays ?? 0;
  if (days > 0) {
    const due = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    await supabase.from("crm_tasks").insert({
      partner_id: pid,
      related_type: accId ? "customer" : "none",
      related_id: accId ?? null,
      related_label: acc || input.subject || "Nachfassen",
      title: `Nachfassen${acc ? ` bei ${acc}` : ""}${input.subject ? ` – ${input.subject}` : ""}`,
      due_date: due,
    });
    revalidatePath("/cockpit/aufgaben");
    revalidatePath("/cockpit/kalender");
  }

  revalidatePath("/cockpit");
  return { ok: true, warning };
}
