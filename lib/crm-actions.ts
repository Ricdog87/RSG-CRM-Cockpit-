"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { findDuplicate } from "@/lib/dedupe";
import { accounts as mockAccounts } from "@/lib/crm-mock";
import { automationEnabled, AUTOMATIONS } from "@/lib/automations";
import { logDataError } from "@/lib/log";
import type { RelatedType } from "@/lib/task-link";

import {
  getValidAccessToken,
  upsertGoogleEvent,
  deleteGoogleEvent,
} from "@/lib/google-calendar";

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

/**
 * Übernimmt den Kunden automatisch ins CRM, wenn er bei Projekt-Anlage noch
 * nicht existiert (Account = Firmenname). Best-effort, blockiert nie die
 * Projekt-Erstellung. Setzt Geschäftslinie + Lifecycle „Kunde".
 */
async function ensureAccount(
  name: string,
  opts: {
    line: "ki" | "recruiting";
    segment?: string;
    ort?: string;
    mrr?: number;
    contact?: string;
    branche?: string;
    contact_email?: string;
  }
): Promise<void> {
  const n = (name || "").trim();
  if (!n || useMockData) return;
  try {
    const { id: pid } = await currentPartnerId();
    if (!pid) return;
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("accounts")
      .select("id")
      .ilike("name", n)
      .maybeSingle();
    if ((existing as { id?: string } | null)?.id) return;

    const row: Record<string, unknown> = {
      partner_id: pid,
      name: n,
      line: opts.line,
      lifecycle: "kunde",
      branche: opts.branche || null,
      segment: opts.segment || null,
      ort: opts.ort || null,
      contact_name: opts.contact || null,
      contact_email: opts.contact_email || null,
      mrr: opts.mrr ?? 0,
    };
    // Graceful: noch nicht migrierte Spalten weglassen.
    for (let attempt = 0; attempt < 6; attempt++) {
      const { error } = await supabase.from("accounts").insert(row);
      if (!error) break;
      const m = error.message.match(MISSING_COL);
      if (m && m[1] in row) {
        delete row[m[1]];
        continue;
      }
      break;
    }
    revalidatePath("/cockpit/kunden");
  } catch {
    /* Kundenübernahme darf das Projekt nie blockieren */
  }
}

/** Normalisierter Schlüssel für den namensbasierten Account-Abgleich. */
function accKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Account-ID per Name auflösen (case-insensitiv). */
async function resolveAccountId(
  supabase: ReturnType<typeof createClient>,
  name: string
): Promise<string | null> {
  const n = (name || "").trim();
  if (!n) return null;
  const { data } = await supabase.from("accounts").select("id").ilike("name", n).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Führt eine Workflow-Automatisierung aus: legt – falls die Regel aktiv ist –
 * automatisch eine Aufgabe an. Best-effort, blockiert nie die auslösende Aktion.
 */
async function autoTask(
  supabase: ReturnType<typeof createClient>,
  pid: string,
  key: string,
  task: {
    related_type?: RelatedType;
    related_id?: string | null;
    related_label?: string | null;
    title: string;
    dueInDays?: number | null;
    notes?: string | null;
  }
): Promise<void> {
  try {
    if (!(await automationEnabled(supabase, pid, key))) return;
    const due =
      task.dueInDays != null
        ? new Date(Date.now() + task.dueInDays * 86400000).toISOString().slice(0, 10)
        : null;
    await supabase.from("crm_tasks").insert({
      partner_id: pid,
      related_type: task.related_type ?? "none",
      related_id: task.related_id ?? null,
      related_label: task.related_label ?? null,
      title: task.title,
      due_date: due,
      notes: task.notes ?? null,
    });
    revalidatePath("/cockpit/aufgaben");
    revalidatePath("/cockpit/kalender");
    if (task.related_type === "customer" && task.related_id)
      revalidatePath(`/cockpit/kunden/${task.related_id}`);
  } catch (e) {
    logDataError(`automation:${key}`, e);
  }
}

/**
 * Materialisiert alle Accounts, die von Mandaten, KI-Projekten, Chancen oder
 * Kandidaten referenziert werden, aber noch keinen eigenen Datensatz haben.
 * Idempotent: bereits vorhandene Accounts werden übersprungen. Behebt den
 * Altbestand-/Import-Fall (z.B. „Lagardère Travel Retail"), bei dem ein Mandat
 * existiert, der Kunde aber nie als Account angelegt wurde.
 */
export async function backfillAccounts(): Promise<ActionResult & { created?: number }> {
  if (useMockData) return { ...DEMO, created: 0 };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  // 1) Referenzierte Namen (inkl. Geschäftslinie) sammeln.
  const refs = new Map<string, { name: string; line: "ki" | "recruiting" }>();
  const addRef = (raw: unknown, line: "ki" | "recruiting") => {
    const name = String(raw ?? "").trim();
    if (!name) return;
    const key = accKey(name);
    if (!refs.has(key)) refs.set(key, { name, line });
  };
  const [m, k, o, c] = await Promise.all([
    supabase.from("recruiting_mandates").select("account_name"),
    supabase.from("ki_projects").select("account_name"),
    supabase.from("opportunities").select("account_name, line"),
    supabase.from("candidates").select("mandate_account"),
  ]);
  for (const r of (m.data as Array<Record<string, unknown>> | null) ?? []) addRef(r.account_name, "recruiting");
  for (const r of (k.data as Array<Record<string, unknown>> | null) ?? []) addRef(r.account_name, "ki");
  for (const r of (o.data as Array<Record<string, unknown>> | null) ?? [])
    addRef(r.account_name, String(r.line ?? "ki") === "recruiting" ? "recruiting" : "ki");
  for (const r of (c.data as Array<Record<string, unknown>> | null) ?? []) addRef(r.mandate_account, "recruiting");

  if (refs.size === 0) return { ok: true, created: 0 };

  // 2) Vorhandene Accounts abziehen.
  const { data: existing } = await supabase.from("accounts").select("name");
  const have = new Set(
    ((existing as Array<{ name?: string }> | null) ?? []).map((a) => accKey(String(a.name ?? "")))
  );

  // 3) Fehlende anlegen (graceful gegen fehlende Spalten).
  let created = 0;
  let lastErr = "";
  for (const { name, line } of refs.values()) {
    if (have.has(accKey(name))) continue;
    const row: Record<string, unknown> = {
      partner_id: pid,
      name,
      line,
      lifecycle: "kunde",
      mrr: 0,
    };
    let ok = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { error: insErr } = await supabase.from("accounts").insert(row);
      if (!insErr) {
        ok = true;
        break;
      }
      lastErr = insErr.message;
      const mm = insErr.message.match(MISSING_COL);
      if (mm && mm[1] in row) {
        delete row[mm[1]];
        continue;
      }
      break;
    }
    if (ok) {
      created++;
      have.add(accKey(name));
    }
  }

  if (created > 0) {
    revalidatePath("/cockpit/kunden");
    revalidatePath("/cockpit/suche");
    revalidatePath("/cockpit");
  }
  return {
    ok: true,
    created,
    warning: created === 0 && lastErr ? `Keine Accounts angelegt. Letzter Fehler: ${lastErr}` : undefined,
  };
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
    country: s(fd, "country") || null,
    owner: s(fd, "owner") || null,
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

/** Normalisiert einen Personennamen für den Dubletten-Abgleich. */
function normPerson(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Bestehende Kandidat:innen (Name + E-Mail) für den Dubletten-Abgleich. */
async function candidateKeys(): Promise<{ name: string; email?: string }[]> {
  if (useMockData) return [];
  const supabase = createClient();
  const { data } = await supabase.from("candidates").select("name, email");
  return ((data as Array<{ name?: string; email?: string }> | null) ?? []).map((r) => ({
    name: String(r.name ?? ""),
    email: r.email ? String(r.email) : undefined,
  }));
}

export async function createCandidate(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };

  // Intelligenter Dubletten-Abgleich (gleiche E-Mail ODER gleicher Name),
  // mit „Trotzdem anlegen" überstimmbar.
  if (s(fd, "force") !== "1" && !useMockData) {
    const name = s(fd, "name");
    const email = s(fd, "email").toLowerCase();
    const nn = normPerson(name);
    const existing = await candidateKeys();
    const dup = existing.find(
      (e) => (email && e.email && e.email.toLowerCase() === email) || (nn && normPerson(e.name) === nn)
    );
    if (dup) {
      return {
        ok: false,
        duplicate: true,
        error: `Mögliche Dublette zu „${dup.name}". Erneut bestätigen, um trotzdem anzulegen.`,
      };
    }
  }

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
  const res = await insertGraceful(
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
      use_case: s(fd, "use_case") || null,
      project_manager: s(fd, "project_manager") || null,
      kickoff_date: s(fd, "kickoff_date") || null,
      decision_maker: s(fd, "decision_maker") || null,
      tech_contact: s(fd, "tech_contact") || null,
    },
    "/cockpit/projekte/ki"
  );
  // Kunde automatisch übernehmen (inkl. MRR & Ansprechpartner aus dem Projekt).
  if (res.ok && !res.demo) {
    const accountName = s(fd, "account_name");
    await ensureAccount(accountName, {
      line: "ki",
      segment: s(fd, "segment"),
      mrr: n(fd, "mrr"),
      branche: s(fd, "acc_branche"),
      ort: s(fd, "acc_ort"),
      contact: s(fd, "acc_contact_name") || s(fd, "decision_maker") || s(fd, "tech_contact"),
      contact_email: s(fd, "acc_contact_email"),
    });
    // Workflow: neues KI-Projekt → Kickoff-Aufgabe beim Kunden.
    try {
      const { id: pid } = await currentPartnerId();
      if (pid) {
        const supabase = createClient();
        const accId = await resolveAccountId(supabase, accountName);
        const product = s(fd, "product") || "KI-Projekt";
        await autoTask(supabase, pid, "ki_onboarding_kickoff", {
          related_type: accId ? "customer" : "none",
          related_id: accId,
          related_label: `${accountName} – ${product}`,
          title: `Kickoff-Termin vereinbaren: ${product}`,
          dueInDays: 2,
        });
      }
    } catch (e) {
      logDataError("automation:ki_onboarding_kickoff", e);
    }
  }
  return res;
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
  const res = await insertGraceful(
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
  // Kunde automatisch übernehmen, falls noch nicht im CRM (Recruiting-Linie).
  if (res.ok && !res.demo) {
    const accountName = s(fd, "account_name");
    await ensureAccount(accountName, {
      line: "recruiting",
      branche: s(fd, "acc_branche"),
      ort: s(fd, "acc_ort"),
      contact: s(fd, "acc_contact_name"),
      contact_email: s(fd, "acc_contact_email"),
    });
    // Workflow: neues Mandat → Sourcing-Aufgabe beim Kunden.
    try {
      const { id: pid } = await currentPartnerId();
      if (pid) {
        const supabase = createClient();
        const accId = await resolveAccountId(supabase, accountName);
        const role = s(fd, "role") || "offene Position";
        await autoTask(supabase, pid, "mandate_sourcing", {
          related_type: accId ? "customer" : "none",
          related_id: accId,
          related_label: `${accountName} – ${role}`,
          title: `Kandidat:innen sourcen: ${role}`,
          dueInDays: 2,
        });
      }
    } catch (e) {
      logDataError("automation:mandate_sourcing", e);
    }
  }
  return res;
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
              .ilike("name", accName)
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
  const res = await update(
    "candidates",
    id,
    { stage, updated_at: new Date().toISOString() },
    "/cockpit/kandidaten"
  );
  // Workflows: Interview → Feedback-Aufgabe, Platziert → Aftercare/NPS.
  if (res.ok && !res.demo && (stage === "interview" || stage === "platziert")) {
    try {
      const { id: pid } = await currentPartnerId();
      if (pid) {
        const supabase = createClient();
        const { data: cand } = await supabase
          .from("candidates")
          .select("name, role")
          .eq("id", id)
          .maybeSingle();
        const c = cand as { name?: string; role?: string } | null;
        const label = c?.name || "Kandidat:in";
        if (stage === "interview") {
          await autoTask(supabase, pid, "candidate_interview_feedback", {
            related_type: "candidate",
            related_id: id,
            related_label: label,
            title: `Interview-Feedback einholen: ${label}`,
            dueInDays: 2,
          });
        } else {
          await autoTask(supabase, pid, "placement_aftercare", {
            related_type: "candidate",
            related_id: id,
            related_label: label,
            title: `Aftercare/NPS prüfen: ${label}${c?.role ? ` (${c.role})` : ""}`,
            dueInDays: 90,
            notes: "Zufriedenheit nach Probezeit prüfen, Referenz/NPS einholen.",
          });
        }
      }
    } catch (e) {
      logDataError("automation:candidate_stage", e);
    }
  }
  return res;
}

export async function updateAccount(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  if (!s(fd, "name")) return { ok: false, error: "Name ist erforderlich." };
  const patch = {
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
    country: s(fd, "country") || null,
    owner: s(fd, "owner") || null,
  };
  // Abgeleiteter (virtueller) Account ohne echten Datensatz → jetzt anlegen.
  if (id.startsWith("ref:")) {
    return insertGraceful("accounts", patch, ["/cockpit/kunden", "/cockpit/suche"]);
  }
  return updateGraceful("accounts", id, patch, ["/cockpit/kunden", `/cockpit/kunden/${id}`]);
}

/** Vermittlungsvertrag/AGB je Kunde aktualisieren. */
export async function updateAccountContract(
  accountId: string,
  patch: {
    engagement_type?: string;
    contract_status?: string;
    contract_signed_at?: string | null;
    fee_agreement?: string | null;
  }
): Promise<ActionResult> {
  if (!accountId) return { ok: false, error: "Datensatz nicht gefunden." };
  return updateGraceful(
    "accounts",
    accountId,
    {
      engagement_type: patch.engagement_type || null,
      contract_status: patch.contract_status || "kein",
      contract_signed_at: patch.contract_signed_at || null,
      fee_agreement: patch.fee_agreement || null,
    },
    ["/cockpit/kunden", `/cockpit/kunden/${accountId}`]
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
  // Abgeleiteter Kunde (nur aus Mandat/Projekt referenziert) – kann nicht direkt
  // gelöscht werden, ohne den referenzierenden Datensatz zu entfernen.
  if (id.startsWith("ref:"))
    return { ok: false, error: "Abgeleiteter Kunde – bitte zuerst das zugehörige Mandat/Projekt entfernen oder umbenennen." };
  return remove("accounts", id, "/cockpit/kunden");
}
export async function deleteCandidate(id: string): Promise<ActionResult> {
  return remove("candidates", id, "/cockpit/kandidaten");
}

/**
 * DSGVO-Anonymisierung: entfernt personenbezogene Daten, behält aber den
 * Datensatz für Statistik/Funnel. Strippt Spalten graceful.
 */
export async function anonymizeCandidate(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  const res = await updateGraceful(
    "candidates",
    id,
    {
      name: "Anonymisiert",
      email: null,
      phone: null,
      salutation: null,
      title: null,
      location: null,
      zip: null,
      photo_path: null,
      cv_path: null,
      cv_filename: null,
      tags: [],
    },
    ["/cockpit/kandidaten", "/cockpit/einwilligungen", `/cockpit/kandidaten/${id}`]
  );
  return res;
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
  // Letzte Aktivität aktualisieren (Health-Score/Briefing); graceful.
  await supabase
    .from("accounts")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", accountId);
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

  const { data: inserted, error: insErr } = await supabase
    .from("crm_tasks")
    .insert({
      partner_id: id,
      related_type: input.related_type ?? "none",
      related_id: input.related_id ?? null,
      related_label: input.related_label ?? null,
      title: input.title.trim(),
      due_date: input.due_date || null,
      due_time: input.due_time || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (insErr) return { ok: false, error: insErr.message };

  // ── Google-Sync (fire-and-forget, blockiert nie den Return) ──────────
  if (input.due_date && inserted) {
    void (async () => {
      try {
        const auth = await getValidAccessToken();
        if (!auth) return;
        const eventId = await upsertGoogleEvent(
          auth.token,
          {
            id: (inserted as { id: string }).id,
            title: input.title.trim(),
            notes: input.notes,
            related_label: input.related_label,
            due_date: input.due_date!,
            due_time: input.due_time,
          },
          null,
          auth.calendarId
        );
        if (eventId) {
          await supabase
            .from("crm_tasks")
            .update({ google_event_id: eventId })
            .eq("id", (inserted as { id: string }).id);
        }
      } catch (e) {
        console.error("[addTask] google sync", e);
      }
    })();
  }
  // ─────────────────────────────────────────────────────────────────────

  revalidateTasks(input.related_type, input.related_id);
  return { ok: true };
}
export async function setTaskDone(
  id: string,
  done: boolean
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase
    .from("crm_tasks")
    .update({ done })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // ── Google-Sync: erledigte Tasks aus Google Calendar entfernen ────────
  if (done) {
    void (async () => {
      try {
        const auth = await getValidAccessToken();
        if (!auth) return;
        const { data: task } = await supabase
          .from("crm_tasks")
          .select("google_event_id")
          .eq("id", id)
          .maybeSingle();
        const gid = (task as { google_event_id?: string | null } | null)
          ?.google_event_id;
        if (gid) {
          await deleteGoogleEvent(auth.token, gid, auth.calendarId);
          await supabase
            .from("crm_tasks")
            .update({ google_event_id: null })
            .eq("id", id);
        }
      } catch (e) {
        console.error("[setTaskDone] google sync", e);
      }
    })();
  }
  // ─────────────────────────────────────────────────────────────────────

  revalidateTasks();
  return { ok: true };
}
export async function deleteTask(id: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();

  // ── Google-Event zuerst löschen (vor DB-Delete, damit ID noch da ist)
  void (async () => {
    try {
      const auth = await getValidAccessToken();
      if (!auth) return;
      const { data: task } = await supabase
        .from("crm_tasks")
        .select("google_event_id")
        .eq("id", id)
        .maybeSingle();
      const gid = (task as { google_event_id?: string | null } | null)
        ?.google_event_id;
      if (gid) {
        await deleteGoogleEvent(auth.token, gid, auth.calendarId);
      }
    } catch (e) {
      console.error("[deleteTask] google sync", e);
    }
  })();
  // ─────────────────────────────────────────────────────────────────────

  const { error } = await supabase.from("crm_tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateTasks();
  return { ok: true };
}

// ---------- KI-Projekt Schnellaktionen (Cockpit) --------------------

export async function updateKiProjectContract(
  id: string,
  patch: {
    contract_start?: string | null;
    contract_end?: string | null;
    term_months?: number | null;
    billing_cycle?: string | null;
    auto_renew?: boolean;
    churn_risk?: string | null;
    nps?: number | null;
    upsell_potential?: string | null;
    upsell_value?: number | null;
  }
): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  return updateGraceful(
    "ki_projects",
    id,
    {
      contract_start: patch.contract_start || null,
      contract_end: patch.contract_end || null,
      term_months: patch.term_months ?? null,
      billing_cycle: patch.billing_cycle || null,
      auto_renew: Boolean(patch.auto_renew),
      churn_risk: patch.churn_risk || null,
      nps: patch.nps ?? null,
      upsell_potential: patch.upsell_potential || null,
      upsell_value: patch.upsell_value ?? null,
    },
    ["/cockpit/projekte/ki", `/cockpit/projekte/ki/${id}`]
  );
}

export async function setKiProjectStatus(id: string, status: string): Promise<ActionResult> {
  const res = await update("ki_projects", id, { status }, "/cockpit/projekte/ki");
  if (res.ok) revalidatePath(`/cockpit/projekte/ki/${id}`);
  return res;
}

export async function setKiProjectHealth(id: string, health: string): Promise<ActionResult> {
  const res = await update("ki_projects", id, { health }, "/cockpit/projekte/ki");
  if (res.ok) revalidatePath(`/cockpit/projekte/ki/${id}`);
  return res;
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

/** Schnelles Verschieben eines Mandats im Kanban-Board (Status). */
export async function setMandateStatus(id: string, status: string): Promise<ActionResult> {
  return update(
    "recruiting_mandates",
    id,
    { status },
    "/cockpit/projekte/recruiting"
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
      use_case: s(fd, "use_case") || null,
      project_manager: s(fd, "project_manager") || null,
      kickoff_date: s(fd, "kickoff_date") || null,
      decision_maker: s(fd, "decision_maker") || null,
      tech_contact: s(fd, "tech_contact") || null,
    },
    ["/cockpit/projekte/ki", `/cockpit/projekte/ki/${id}`]
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
