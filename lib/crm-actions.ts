"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

/**
 * Server Actions für Schreibvorgänge im CRM. Bei gesetzter Supabase-ENV wird
 * RLS-konform in die CRM-Tabellen geschrieben (partner_id = eigene Partner-ID).
 * Im Demo-Modus (keine ENV) wird nichts persistiert – die UI meldet das klar.
 */
export type ActionResult = { ok: boolean; demo?: boolean; error?: string };

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

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function n(fd: FormData, key: string): number {
  return Number(fd.get(key) ?? 0) || 0;
}

async function insert(
  table: string,
  row: Record<string, unknown>,
  revalidate: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id, error } = await currentPartnerId();
  if (!id) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase
    .from(table)
    .insert({ ...row, partner_id: id });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath(revalidate);
  return { ok: true };
}

export async function createAccount(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };
  return insert(
    "accounts",
    {
      name: s(fd, "name"),
      branche: s(fd, "branche"),
      segment: s(fd, "segment"),
      line: s(fd, "line") || "ki",
      lifecycle: s(fd, "lifecycle") || "lead",
      contact_name: s(fd, "contact_name"),
      contact_email: s(fd, "contact_email"),
      mrr: n(fd, "mrr"),
      ort: s(fd, "ort"),
    },
    "/cockpit/kunden"
  );
}

export async function createOpportunity(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!s(fd, "account_name")) return { ok: false, error: "Account ist erforderlich." };
  return insert(
    "opportunities",
    {
      account_name: s(fd, "account_name"),
      line: s(fd, "line") || "ki",
      title: s(fd, "title"),
      value: n(fd, "value"),
      value_type: s(fd, "value_type") || "mrr",
      stage: s(fd, "stage") || "neu",
      probability: n(fd, "probability"),
      owner: s(fd, "owner"),
      expected_close: s(fd, "expected_close") || null,
    },
    "/cockpit/sales"
  );
}

export async function createCandidate(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };
  return insert(
    "candidates",
    {
      name: s(fd, "name"),
      role: s(fd, "role"),
      mandate_account: s(fd, "mandate_account"),
      stage: s(fd, "stage") || "neu",
      source: s(fd, "source"),
    },
    "/cockpit/kandidaten"
  );
}

export async function createSegment(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };
  return insert(
    "segments",
    {
      name: s(fd, "name"),
      description: s(fd, "description"),
      top_product: s(fd, "top_product"),
    },
    "/cockpit/segmente"
  );
}

export async function createMandate(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!s(fd, "account_name")) return { ok: false, error: "Account ist erforderlich." };
  return insert(
    "recruiting_mandates",
    {
      account_name: s(fd, "account_name"),
      role: s(fd, "role"),
      positions: n(fd, "positions") || 1,
      filled: 0,
      status: s(fd, "status") || "offen",
      fee: n(fd, "fee") || 9999,
      candidate_count: 0,
      deadline: s(fd, "deadline") || null,
    },
    "/cockpit/projekte/recruiting"
  );
}

// ---------- Update / Stage-Wechsel ----------------------------------

async function update(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  revalidate: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  // RLS beschränkt zusätzlich auf eigene Datensätze.
  const { error: updErr } = await supabase.from(table).update(patch).eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath(revalidate);
  return { ok: true };
}

export async function updateOpportunityStage(
  id: string,
  stage: string
): Promise<ActionResult> {
  return update("opportunities", id, { stage }, "/cockpit/sales");
}

export async function updateCandidateStage(
  id: string,
  stage: string
): Promise<ActionResult> {
  return update(
    "candidates",
    id,
    { stage, updated_at: new Date().toISOString() },
    "/cockpit/kandidaten"
  );
}

export async function updateAccount(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };
  return update(
    "accounts",
    id,
    {
      name: s(fd, "name"),
      branche: s(fd, "branche"),
      segment: s(fd, "segment"),
      line: s(fd, "line") || "ki",
      lifecycle: s(fd, "lifecycle") || "lead",
      contact_name: s(fd, "contact_name"),
      contact_email: s(fd, "contact_email"),
      mrr: n(fd, "mrr"),
      ort: s(fd, "ort"),
    },
    "/cockpit/kunden"
  );
}

// ---------- Löschen --------------------------------------------------

async function remove(
  table: string,
  id: string,
  revalidate: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: delErr } = await supabase.from(table).delete().eq("id", id);
  if (delErr) return { ok: false, error: delErr.message };
  revalidatePath(revalidate);
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  return remove("accounts", id, "/cockpit/kunden");
}
export async function deleteCandidate(id: string): Promise<ActionResult> {
  return remove("candidates", id, "/cockpit/kandidaten");
}
export async function deleteMandate(id: string): Promise<ActionResult> {
  return remove("recruiting_mandates", id, "/cockpit/projekte/recruiting");
}
export async function deleteSegment(id: string): Promise<ActionResult> {
  return remove("segments", id, "/cockpit/segmente");
}
