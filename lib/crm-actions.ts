"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { findDuplicate } from "@/lib/dedupe";
import { accounts as mockAccounts } from "@/lib/crm-mock";
import { automationEnabled, AUTOMATIONS } from "@/lib/automations";
import { logDataError } from "@/lib/log";
import type { RelatedType } from "@/lib/task-link";

/**
 * Server Actions für Schreibvorgänge im CRM. Bei gesetzter Supabase-ENV wird
 * RLS-konform in die CRM-Tabellen geschrieben (partner_id = eigene Partner-ID).
 * Im Demo-Modus (keine ENV) wird nichts persistiert – die UI meldet das klar.
 */
export type ActionResult = {
  ok: boolean;
  demo?: boolean;
  error?: string;
  /** true ⇒ mögliche Dublette erkannt (mit force=1 überstimmbar) */
  duplicate?: boolean;
  /**
   * Gesetzt, wenn der Datensatz gespeichert wurde, aber einzelne Felder
   * verworfen werden mussten (Spalte fehlt – Migration noch nicht eingespielt).
   * Der Dialog bleibt dann offen und zeigt den Hinweis an.
   */
  warning?: string;
};

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

const MISSING_COL = /column "?([a-z_]+)"? .*does not exist/i;

/** Hinweis, der angezeigt wird, wenn Felder mangels DB-Spalte verworfen wurden. */
function strippedWarning(table: string, stripped: string[]): string | undefined {
  if (stripped.length === 0) return undefined;
  const fields = stripped.filter((c) => c !== "partner_id");
  if (fields.length === 0) return undefined;
  const mig =
    table === "candidates"
      ? "08_candidate_matching.sql"
      : table === "accounts"
        ? "07_account_phone.sql"
        : table === "recruiting_mandates"
          ? "09_mandate_pricing.sql"
          : table === "ki_projects"
            ? "10_ki_setup_fee.sql"
            : "die passende Migration";
  return `Gespeichert – aber diese Felder konnten nicht abgelegt werden, weil die Spalten in der Datenbank fehlen: ${fields.join(
    ", "
  )}. Bitte ${mig} im Supabase SQL-Editor ausführen und erneut speichern.`;
}

/** Insert, das fehlende (noch nicht migrierte) Spalten automatisch weglässt. */
async function insertGraceful(
  table: string,
  row: Record<string, unknown>,
  revalidate: string | string[]
): Promise<ActionResult & { id?: string }> {
  if (useMockData) return DEMO;
  const { id, error } = await currentPartnerId();
  if (!id) return { ok: false, error };
  const supabase = createClient();
  let payload: Record<string, unknown> = { ...row, partner_id: id };
  const stripped: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error: insErr } = await supabase.from(table).insert(payload).select("id").single();
    if (!insErr) {
      revalidateMany(revalidate);
      return { ok: true, id: (data as { id?: string } | null)?.id, warning: strippedWarning(table, stripped) };
    }
    const m = insErr.message.match(MISSING_COL);
    if (m && m[1] in payload) {
      const next = { ...payload };
      delete next[m[1]];
      payload = next;
      stripped.push(m[1]);
      continue;
    }
    return { ok: false, error: insErr.message };
  }
  return { ok: false, error: "Anlegen fehlgeschlagen." };
}

/** Update, das fehlende (noch nicht migrierte) Spalten automatisch weglässt. */
async function updateGraceful(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  revalidate: string | string[]
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  let payload: Record<string, unknown> = { ...patch };
  const stripped: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error: updErr } = await supabase.from(table).update(payload).eq("id", id);
    if (!updErr) {
      revalidateMany(revalidate);
      return { ok: true, warning: strippedWarning(table, stripped) };
    }
    const m = updErr.message.match(MISSING_COL);
    if (m && m[1] in payload) {
      const next = { ...payload };
      delete next[m[1]];
      payload = next;
      stripped.push(m[1]);
      continue;
    }
    return { ok: false, error: updErr.message };
  }
  return { ok: false, error: "Speichern fehlgeschlagen." };
}

function revalidateMany(paths: string | string[]) {
  for (const p of Array.isArray(paths) ? paths : [paths]) revalidatePath(p);
}

/** Bestehende Account-Schlüssel (Name + E-Mail) für den Dubletten-Abgleich. */
async function accountKeys(): Promise<{ name: string; email?: string }[]> {
  if (useMockData) {
    return mockAccounts.map((a) => ({ name: a.name, email: a.contact_email }));
  }
  const supabase = createClient();
  const { data } = await supabase.from("accounts").select("name, contact_email");
  return (
    (data as Array<{ name?: string; contact_email?: string }> | null) ?? []
  ).map((r) => ({
    name: String(r.name ?? ""),
    email: r.contact_email ? String(r.contact_email) : undefined,
  }));
}

export async function createAccount(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const name = s(fd, "name");
  if (!name) return { ok: false, error: "Name ist erforderlich." };

  // Intelligenter Dubletten-Abgleich (mit „Trotzdem anlegen" überstimmbar).
  if (s(fd, "force") !== "1") {
    const dup = findDuplicate(
      { name, email: s(fd, "contact_email") || undefined },
      await accountKeys()
    );
    if (dup) {
      return {
        ok: false,
        duplicate: true,
        error: `Mögliche Dublette zu „${dup.name}". Erneut bestätigen, um trotzdem anzulegen.`,
      };
    }
  }

  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const lifecycle = s(fd, "lifecycle") || "lead";

  const row: Record<string, unknown> = {
    partner_id: pid,
    name,
    branche: s(fd, "branche"),
    segment: s(fd, "segment"),
    line: s(fd, "line") || "ki",
    lifecycle,
    contact_name: s(fd, "contact_name"),
    contact_email: s(fd, "contact_email"),
    contact_phone: s(fd, "contact_phone") || null,
    mrr: n(fd, "mrr"),
    ort: s(fd, "ort"),
  };
  // Robust gegen noch nicht migrierte Spalten: fehlende Spalten werden
  // automatisch weggelassen, damit das Anlegen nie komplett scheitert.
  let ins: { id?: string } | null = null;
  let insErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await supabase.from("accounts").insert(row).select("id").single();
    ins = res.data as { id?: string } | null;
    insErr = res.error;
    if (!insErr) break;
    const m = insErr.message.match(MISSING_COL);
    if (m && m[1] in row) {
      delete row[m[1]];
      continue;
    }
    break;
  }
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath("/cockpit/kunden");

  // Workflow: neuer Lead → Erstkontakt-Aufgabe (darf das Anlegen nie blockieren).
  const accountId = (ins as { id: string }).id;
  try {
    if (lifecycle === "lead" && (await automationEnabled(supabase, pid, "lead_followup"))) {
      const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      await supabase.from("crm_tasks").insert({
        partner_id: pid,
        related_type: "customer",
        related_id: accountId,
        related_label: name,
        title: "Erstkontakt vereinbaren",
        due_date: due,
      });
    }
  } catch (e) {
    logDataError("automation:lead_followup", e);
  }
  return { ok: true };
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
  return insertGraceful(
    "candidates",
    {
      name: s(fd, "name"),
      salutation: s(fd, "salutation") || null,
      title: s(fd, "title") || null,
      role: s(fd, "role"),
      email: s(fd, "email") || null,
      phone: s(fd, "phone") || null,
      mandate_account: s(fd, "mandate_account"),
      mandate_id: s(fd, "mandate_id") || null,
      stage: s(fd, "stage") || "neu",
      source: s(fd, "source"),
      location: s(fd, "location") || null,
      zip: s(fd, "zip") || null,
      willing_to_relocate: relocateValue(fd),
      travel_willingness: s(fd, "travel_willingness") || null,
      salary_expectation: fd.get("salary_expectation") ? n(fd, "salary_expectation") : null,
      availability: s(fd, "availability") || null,
    },
    "/cockpit/kandidaten"
  );
}

/** "ja"/"nein"/"" → boolean | null */
function relocateValue(fd: FormData): boolean | null {
  const v = s(fd, "willing_to_relocate");
  return v === "ja" ? true : v === "nein" ? false : null;
}

export async function createKiProject(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!s(fd, "account_name")) return { ok: false, error: "Account ist erforderlich." };
  return insertGraceful(
    "ki_projects",
    {
      account_name: s(fd, "account_name"),
      product: s(fd, "product"),
      segment: s(fd, "segment"),
      status: s(fd, "status") || "onboarding",
      mrr: n(fd, "mrr"),
      setup_fee: n(fd, "setup_fee"),
      go_live: s(fd, "go_live") || null,
      health: s(fd, "health") || "neutral",
    },
    "/cockpit/projekte/ki"
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
  const pricing = s(fd, "pricing_model") === "percent" ? "percent" : "fixed";
  return insertGraceful(
    "recruiting_mandates",
    {
      account_name: s(fd, "account_name"),
      role: s(fd, "role"),
      positions: n(fd, "positions") || 1,
      filled: 0,
      status: s(fd, "status") || "offen",
      pricing_model: pricing,
      fee: pricing === "fixed" ? n(fd, "fee") || 9999 : n(fd, "fee"),
      target_salary: pricing === "percent" ? n(fd, "target_salary") : null,
      fee_percent: pricing === "percent" ? n(fd, "fee_percent") || 25 : null,
      deposit: pricing === "fixed" ? n(fd, "deposit") : 0,
      split_payment: s(fd, "split_payment") === "1",
      job_posting: s(fd, "job_posting") || null,
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
  const res = await update("opportunities", id, { stage }, "/cockpit/sales");
  // Workflow: Chance gewonnen → Onboarding-Aufgabe beim Account.
  if (res.ok && !res.demo && stage === "gewonnen") {
    try {
      const { id: pid } = await currentPartnerId();
      if (pid) {
        const supabase = createClient();
        if (await automationEnabled(supabase, pid, "won_onboarding")) {
          const { data: opp } = await supabase
            .from("opportunities")
            .select("account_name")
            .eq("id", id)
            .single();
          const accName = (opp as { account_name?: string } | null)?.account_name;
          if (accName) {
            const { data: acc } = await supabase
              .from("accounts")
              .select("id")
              .eq("name", accName)
              .maybeSingle();
            const accId = (acc as { id?: string } | null)?.id;
            if (accId) {
              await supabase.from("crm_tasks").insert({
                partner_id: pid,
                related_type: "customer",
                related_id: accId,
                related_label: accName,
                title: `Onboarding starten: ${accName}`,
              });
              revalidatePath(`/cockpit/kunden/${accId}`);
            }
          }
        }
      }
    } catch (e) {
      // Automation darf den Phasenwechsel nie blockieren – aber sichtbar loggen.
      logDataError("automation:won_onboarding", e);
    }
  }
  return res;
}

/** Setzt eine Automatisierungs-Regel an/aus. */
export async function setAutomation(
  key: string,
  enabled: boolean
): Promise<ActionResult> {
  if (!AUTOMATIONS.some((a) => a.key === key)) return { ok: false, error: "Unbekannte Regel." };
  if (useMockData) return DEMO;
  const { id, error } = await currentPartnerId();
  if (!id) return { ok: false, error };
  const supabase = createClient();
  const { error: e } = await supabase
    .from("automations")
    .upsert(
      { partner_id: id, key, enabled, updated_at: new Date().toISOString() },
      { onConflict: "partner_id,key" }
    );
  if (e) return { ok: false, error: e.message };
  revalidatePath("/cockpit/automatisierungen");
  return { ok: true };
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
  return updateGraceful(
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
      contact_phone: s(fd, "contact_phone") || null,
      mrr: n(fd, "mrr"),
      ort: s(fd, "ort"),
    },
    ["/cockpit/kunden", `/cockpit/kunden/${id}`]
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
export async function deleteKiProject(id: string): Promise<ActionResult> {
  return remove("ki_projects", id, "/cockpit/projekte/ki");
}

// ---------- Notizen je Account --------------------------------------

export async function addNote(
  accountId: string,
  body: string
): Promise<ActionResult> {
  if (!body.trim()) return { ok: false, error: "Leere Notiz." };
  if (useMockData) return DEMO;
  const { id, error } = await currentPartnerId();
  if (!id) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase.from("account_notes").insert({
    partner_id: id,
    account_id: accountId,
    body: body.trim(),
  });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath(`/cockpit/kunden/${accountId}`);
  return { ok: true };
}

export async function deleteNote(
  id: string,
  accountId: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("account_notes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kunden/${accountId}`);
  return { ok: true };
}

// ---------- Kontakte je Account -------------------------------------

export async function addContact(
  accountId: string,
  contact: {
    name: string;
    salutation?: string;
    title?: string;
    role?: string;
    email?: string;
    phone?: string;
  }
): Promise<ActionResult> {
  if (!contact.name?.trim()) return { ok: false, error: "Name erforderlich." };
  if (useMockData) return DEMO;
  const { id, error } = await currentPartnerId();
  if (!id) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase.from("account_contacts").insert({
    partner_id: id,
    account_id: accountId,
    salutation: contact.salutation?.trim() || null,
    title: contact.title?.trim() || null,
    name: contact.name.trim(),
    role: contact.role?.trim() || null,
    email: contact.email?.trim() || null,
    phone: contact.phone?.trim() || null,
  });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath(`/cockpit/kunden/${accountId}`);
  return { ok: true };
}

export async function deleteContact(
  id: string,
  accountId: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("account_contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kunden/${accountId}`);
  return { ok: true };
}

// ---------- Aufgaben/Termine (einheitlich, crm_tasks) ---------------

function revalidateTasks(relatedType?: string, relatedId?: string | null) {
  revalidatePath("/cockpit/aufgaben");
  revalidatePath("/cockpit/kalender");
  revalidatePath("/cockpit");
  if (relatedType === "customer" && relatedId) {
    revalidatePath(`/cockpit/kunden/${relatedId}`);
  }
}

export interface TaskInput {
  related_type: RelatedType;
  related_id?: string | null;
  related_label?: string | null;
  title: string;
  due_date?: string | null;
  due_time?: string | null;
  notes?: string | null;
}

export async function addTask(input: TaskInput): Promise<ActionResult> {
  if (!input.title?.trim()) return { ok: false, error: "Titel erforderlich." };
  if (useMockData) return DEMO;
  const { id, error } = await currentPartnerId();
  if (!id) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase.from("crm_tasks").insert({
    partner_id: id,
    related_type: input.related_type ?? "none",
    related_id: input.related_id ?? null,
    related_label: input.related_label ?? null,
    title: input.title.trim(),
    due_date: input.due_date || null,
    due_time: input.due_time || null,
    notes: input.notes || null,
  });
  if (insErr) return { ok: false, error: insErr.message };
  revalidateTasks(input.related_type, input.related_id);
  return { ok: true };
}

export async function setTaskDone(
  id: string,
  done: boolean
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("crm_tasks").update({ done }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateTasks();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("crm_tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateTasks();
  return { ok: true };
}

// ---------- Update der übrigen Entitäten ----------------------------

export async function updateCandidate(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };
  return updateGraceful(
    "candidates",
    id,
    {
      name: s(fd, "name"),
      salutation: s(fd, "salutation") || null,
      title: s(fd, "title") || null,
      role: s(fd, "role"),
      email: s(fd, "email") || null,
      phone: s(fd, "phone") || null,
      mandate_account: s(fd, "mandate_account"),
      mandate_id: s(fd, "mandate_id") || null,
      stage: s(fd, "stage") || "neu",
      source: s(fd, "source"),
      location: s(fd, "location") || null,
      zip: s(fd, "zip") || null,
      willing_to_relocate: relocateValue(fd),
      travel_willingness: s(fd, "travel_willingness") || null,
      salary_expectation: fd.get("salary_expectation") ? n(fd, "salary_expectation") : null,
      availability: s(fd, "availability") || null,
      updated_at: new Date().toISOString(),
    },
    ["/cockpit/kandidaten", `/cockpit/kandidaten/${id}`]
  );
}

export async function updateMandate(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  if (!s(fd, "account_name")) return { ok: false, error: "Account ist erforderlich." };
  const pricing = s(fd, "pricing_model") === "percent" ? "percent" : "fixed";
  return updateGraceful(
    "recruiting_mandates",
    id,
    {
      account_name: s(fd, "account_name"),
      role: s(fd, "role"),
      positions: n(fd, "positions") || 1,
      filled: n(fd, "filled"),
      status: s(fd, "status") || "offen",
      pricing_model: pricing,
      fee: pricing === "fixed" ? n(fd, "fee") || 9999 : n(fd, "fee"),
      target_salary: pricing === "percent" ? n(fd, "target_salary") : null,
      fee_percent: pricing === "percent" ? n(fd, "fee_percent") || 25 : null,
      deposit: pricing === "fixed" ? n(fd, "deposit") : 0,
      split_payment: s(fd, "split_payment") === "1",
      job_posting: s(fd, "job_posting") || null,
      deadline: s(fd, "deadline") || null,
    },
    ["/cockpit/projekte/recruiting", `/cockpit/projekte/recruiting/${id}`]
  );
}

export async function updateSegment(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };
  return update(
    "segments",
    id,
    {
      name: s(fd, "name"),
      description: s(fd, "description"),
      top_product: s(fd, "top_product"),
    },
    "/cockpit/segmente"
  );
}

export async function updateKiProject(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  return updateGraceful(
    "ki_projects",
    id,
    {
      account_name: s(fd, "account_name"),
      product: s(fd, "product"),
      segment: s(fd, "segment"),
      status: s(fd, "status") || "onboarding",
      mrr: n(fd, "mrr"),
      setup_fee: n(fd, "setup_fee"),
      go_live: s(fd, "go_live") || null,
      health: s(fd, "health") || "neutral",
    },
    "/cockpit/projekte/ki"
  );
}

// ---------- Notizen je Kandidat:in ----------------------------------

export async function addCandidateNote(
  candidateId: string,
  body: string,
  kind: "note" | "call" | "meeting" = "note"
): Promise<ActionResult> {
  if (!body.trim()) return { ok: false, error: "Leerer Eintrag." };
  if (useMockData) return DEMO;
  const { id, error } = await currentPartnerId();
  if (!id) return { ok: false, error };
  const supabase = createClient();
  const base = { partner_id: id, candidate_id: candidateId, body: body.trim() };

  let { error: insErr } = await supabase.from("candidate_notes").insert({ ...base, kind });
  // Migration 04 (kind-Spalte) noch nicht eingespielt → ohne kind speichern,
  // damit Einträge nicht verloren gehen.
  if (insErr && /column .*kind.* does not exist/i.test(insErr.message)) {
    ({ error: insErr } = await supabase.from("candidate_notes").insert(base));
  }
  if (insErr) {
    if (/relation .*candidate_notes.* does not exist/i.test(insErr.message)) {
      return { ok: false, error: "Tabelle candidate_notes fehlt – Migration 03_candidate_notes.sql ausführen." };
    }
    return { ok: false, error: insErr.message };
  }
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

export async function deleteCandidateNote(
  id: string,
  candidateId: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("candidate_notes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

// ---------- Bewertung & Tags je Kandidat:in -------------------------

export async function setCandidateRating(
  id: string,
  rating: number
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  const { error } = await supabase
    .from("candidates")
    .update({ rating: r || null })
    .eq("id", id);
  if (error) {
    if (/column .*rating.* does not exist/i.test(error.message))
      return { ok: false, error: "Spalte rating fehlt – Migration 06_candidate_rating_tags.sql ausführen." };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/cockpit/kandidaten/${id}`);
  return { ok: true };
}

export async function setCandidateTags(
  id: string,
  tags: string[]
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const clean = Array.from(
    new Set(tags.map((t) => t.trim()).filter(Boolean))
  ).slice(0, 20);
  const { error } = await supabase
    .from("candidates")
    .update({ tags: clean })
    .eq("id", id);
  if (error) {
    if (/column .*tags.* does not exist/i.test(error.message))
      return { ok: false, error: "Spalte tags fehlt – Migration 06_candidate_rating_tags.sql ausführen." };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/cockpit/kandidaten/${id}`);
  return { ok: true };
}
