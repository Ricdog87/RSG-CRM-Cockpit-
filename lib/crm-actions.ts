"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { findDuplicate } from "@/lib/dedupe";
import { nameFromSyntheticId, isSyntheticAccountId } from "@/lib/crm-data";
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

function eurStr(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
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
function strippedWarning(_table: string, stripped: string[]): string | undefined {
  const fields = stripped.filter((c) => c !== "partner_id");
  if (fields.length === 0) return undefined;
  return `Achtung: Diese Felder konnten NICHT gespeichert werden, weil die Spalten in der Datenbank fehlen: ${fields.join(
    ", "
  )}. Bitte einmalig die Migration „supabase/27_persistence_fix.sql" im Supabase SQL-Editor ausführen – danach bleiben alle Eingaben dauerhaft erhalten.`;
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
      .limit(1);
    if ((existing as Array<{ id?: string }> | null)?.[0]?.id) return;

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
  // limit(1) statt maybeSingle: robust gegen bereits vorhandene Dubletten.
  const { data } = await supabase.from("accounts").select("id").ilike("name", n).limit(1);
  return (data as Array<{ id?: string }> | null)?.[0]?.id ?? null;
}

/**
 * Hält die Account-MRR konsistent: Summe der laufenden KI-Projekte des Kunden.
 * Wird nach KI-Projekt-Änderungen aufgerufen (denormalisierte mrr aktuell halten).
 */
async function syncAccountMrr(
  supabase: ReturnType<typeof createClient>,
  accountName: string
): Promise<void> {
  const n = (accountName || "").trim();
  if (!n) return;
  try {
    const accId = await resolveAccountId(supabase, n);
    if (!accId) return;
    const { data } = await supabase.from("ki_projects").select("mrr, status").ilike("account_name", n);
    const sum = ((data as Array<{ mrr?: number; status?: string }> | null) ?? [])
      .filter((p) => p.status !== "gekuendigt" && p.status !== "angebot")
      .reduce((s, p) => s + Number(p.mrr ?? 0), 0);
    await supabase.from("accounts").update({ mrr: sum }).eq("id", accId);
    revalidatePath("/cockpit/kunden");
    revalidatePath(`/cockpit/kunden/${accId}`);
  } catch {
    /* best effort */
  }
}

/**
 * Macht aus einer abgeleiteten (virtuellen) Account-ID „ref:…“ einen echten
 * Datensatz – beim ersten Schreibzugriff (Notiz/Aufgabe/Kontakt). Gibt die
 * echte Account-ID zurück (oder null, falls nicht möglich).
 */
async function materializeAccount(
  supabase: ReturnType<typeof createClient>,
  pid: string,
  accountId: string
): Promise<string | null> {
  if (!isSyntheticAccountId(accountId)) return accountId;
  const name = nameFromSyntheticId(accountId);
  if (!name) return null;
  const existing = await resolveAccountId(supabase, name);
  if (existing) return existing;
  const row: Record<string, unknown> = { partner_id: pid, name, lifecycle: "kunde", mrr: 0 };
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await supabase.from("accounts").insert(row).select("id").single();
    if (!res.error) return (res.data as { id?: string } | null)?.id ?? null;
    const m = res.error.message.match(MISSING_COL);
    if (m && m[1] in row) {
      delete row[m[1]];
      continue;
    }
    break;
  }
  return null;
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
    strasse: s(fd, "strasse") || null,
    plz: s(fd, "plz") || null,
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

/** Vollständiges Bearbeiten einer Verkaufschance (nicht nur Phasenwechsel). */
export async function updateOpportunity(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Datensatz nicht gefunden." };
  if (!s(fd, "account_name")) return { ok: false, error: "Account ist erforderlich." };
  return updateGraceful(
    "opportunities",
    id,
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

export async function deleteOpportunity(id: string): Promise<ActionResult> {
  return remove("opportunities", id, "/cockpit/sales");
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
      birth_date: s(fd, "birth_date") || null,
      current_employer: s(fd, "current_employer") || null,
      languages: s(fd, "languages") || null,
      experience_years: fd.get("experience_years") ? n(fd, "experience_years") : null,
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
    try {
      await syncAccountMrr(createClient(), accountName);
    } catch {
      /* best effort */
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
  // Workflow: Chance verloren → Wiedervorlage (90 T) zur Reaktivierung.
  if (res.ok && !res.demo && stage === "verloren") {
    try {
      const { id: pid } = await currentPartnerId();
      if (pid) {
        const supabase = createClient();
        const { data: opp } = await supabase
          .from("opportunities")
          .select("account_name, title")
          .eq("id", id)
          .maybeSingle();
        const o = opp as { account_name?: string; title?: string } | null;
        const accName = o?.account_name ?? "";
        const accId = accName ? await resolveAccountId(supabase, accName) : null;
        await autoTask(supabase, pid, "lost_reengage", {
          related_type: accId ? "customer" : "none",
          related_id: accId,
          related_label: accName || o?.title || "Verlorene Chance",
          title: `Erneut ansprechen: ${accName}${o?.title ? ` (${o.title})` : ""}`,
          dueInDays: 90,
          notes: "Verlorene Chance – nach Reifezeit erneut qualifizieren.",
        });
      }
    } catch (e) {
      logDataError("automation:lost_reengage", e);
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
  // Workflows: Interview → Feedback, Angebot → Nachfassen, Platziert → Aftercare/NPS.
  if (res.ok && !res.demo && (stage === "interview" || stage === "angebot" || stage === "platziert")) {
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
        } else if (stage === "angebot") {
          await autoTask(supabase, pid, "candidate_offer_followup", {
            related_type: "candidate",
            related_id: id,
            related_label: label,
            title: `Angebot nachfassen: ${label}${c?.role ? ` (${c.role})` : ""}`,
            dueInDays: 3,
            notes: "Rückmeldung zum Angebot einholen, offene Punkte klären.",
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
    strasse: s(fd, "strasse") || null,
    plz: s(fd, "plz") || null,
    country: s(fd, "country") || null,
    owner: s(fd, "owner") || null,
  };
  // Abgeleiteter (virtueller) Account ODER bereits (leer) materialisierter Kunde:
  // Upsert über den Namen – existiert schon ein echter Datensatz, wird DIESER
  // aktualisiert (verhindert Dubletten/Datenverlust); sonst neu anlegen.
  if (isSyntheticAccountId(id)) {
    if (useMockData) return DEMO;
    const { id: pid, error } = await currentPartnerId();
    if (!pid) return { ok: false, error };
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("accounts")
      .select("id")
      .ilike("name", patch.name)
      .limit(1);
    const existingId = (rows as Array<{ id?: string }> | null)?.[0]?.id;
    if (existingId) {
      return updateGraceful("accounts", existingId, patch, [
        "/cockpit/kunden",
        `/cockpit/kunden/${existingId}`,
      ]);
    }
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
  if (isSyntheticAccountId(id))
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
  let accountName = "";
  if (!useMockData) {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("ki_projects").select("account_name").eq("id", id).maybeSingle();
      accountName = String((data as { account_name?: string } | null)?.account_name ?? "");
    } catch {
      /* ignore */
    }
  }
  const res = await remove("ki_projects", id, "/cockpit/projekte/ki");
  if (res.ok && !res.demo && accountName) {
    try {
      await syncAccountMrr(createClient(), accountName);
    } catch {
      /* best effort */
    }
  }
  return res;
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
  accountId = (await materializeAccount(supabase, id, accountId)) ?? accountId;
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
  accountId = (await materializeAccount(supabase, id, accountId)) ?? accountId;
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

export async function updateContact(
  id: string,
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
  const supabase = createClient();
  const { error } = await supabase
    .from("account_contacts")
    .update({
      salutation: contact.salutation?.trim() || null,
      title: contact.title?.trim() || null,
      name: contact.name.trim(),
      role: contact.role?.trim() || null,
      email: contact.email?.trim() || null,
      phone: contact.phone?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
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

  // Virtuellen Kunden bei Bedarf materialisieren, damit der Bezug greift.
  let relatedId = input.related_id ?? null;
  if (input.related_type === "customer" && relatedId != null && isSyntheticAccountId(relatedId)) {
    relatedId = (await materializeAccount(supabase, id, relatedId)) ?? relatedId;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("crm_tasks")
    .insert({
      partner_id: id,
      related_type: input.related_type ?? "none",
      related_id: relatedId,
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
  if (res.ok && !res.demo) {
    revalidatePath(`/cockpit/projekte/ki/${id}`);
    try {
      const supabase = createClient();
      const { data } = await supabase.from("ki_projects").select("account_name").eq("id", id).maybeSingle();
      await syncAccountMrr(supabase, String((data as { account_name?: string } | null)?.account_name ?? ""));
    } catch {
      /* best effort */
    }
  }
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
      birth_date: s(fd, "birth_date") || null,
      current_employer: s(fd, "current_employer") || null,
      languages: s(fd, "languages") || null,
      experience_years: fd.get("experience_years") ? n(fd, "experience_years") : null,
      updated_at: new Date().toISOString(),
    },
    ["/cockpit/kandidaten", `/cockpit/kandidaten/${id}`]
  );
}

/** Schnelles Verschieben eines Mandats im Kanban-Board (Status). */
export async function setMandateStatus(id: string, status: string): Promise<ActionResult> {
  const res = await update(
    "recruiting_mandates",
    id,
    { status },
    "/cockpit/projekte/recruiting"
  );
  // Workflow: Mandat besetzt → Honorar-Rechnung stellen.
  if (res.ok && !res.demo && status === "besetzt") {
    try {
      const { id: pid } = await currentPartnerId();
      if (pid) {
        const supabase = createClient();
        const { data: m } = await supabase
          .from("recruiting_mandates")
          .select("account_name, role, pricing_model, fee, deposit, positions, fee_percent, target_salary")
          .eq("id", id)
          .maybeSingle();
        const mand = m as {
          account_name?: string;
          role?: string;
          pricing_model?: string;
          fee?: number;
          deposit?: number;
          positions?: number;
          fee_percent?: number;
          target_salary?: number;
        } | null;
        const accName = mand?.account_name ?? "";
        const accId = accName ? await resolveAccountId(supabase, accName) : null;
        const roleSuffix = mand?.role ? ` (${mand.role})` : "";
        // Festpreis: konkrete Restzahlung anfordern (Honorar − Anzahlung).
        let title = `Honorar-Rechnung stellen: ${accName}${roleSuffix}`;
        if ((mand?.pricing_model ?? "fixed") !== "percent") {
          const positions = mand?.positions || 1;
          const rest = Math.max(0, (mand?.fee ?? 0) * positions - (mand?.deposit ?? 0) * positions);
          if (rest > 0) title = `Restzahlung ${eurStr(rest)} anfordern: ${accName}${roleSuffix}`;
        }
        await autoTask(supabase, pid, "placement_invoice", {
          related_type: accId ? "customer" : "none",
          related_id: accId,
          related_label: `${accName}${mand?.role ? ` – ${mand.role}` : ""}`,
          title,
          dueInDays: 1,
        });
      }
    } catch (e) {
      logDataError("automation:placement_invoice", e);
    }
  }
  return res;
}

/**
 * Festpreis-Zahlungs-Gate: Anzahlung als bezahlt markieren → Suche/Sourcing
 * kann starten (legt direkt eine Sourcing-Aufgabe an).
 */
export async function setMandateDepositPaid(id: string, paid: boolean): Promise<ActionResult> {
  const res = await updateGraceful(
    "recruiting_mandates",
    id,
    {
      deposit_paid: paid,
      deposit_paid_at: paid ? new Date().toISOString().slice(0, 10) : null,
    },
    ["/cockpit/projekte/recruiting", `/cockpit/projekte/recruiting/${id}`]
  );
  if (res.ok && !res.demo && paid) {
    try {
      const { id: pid } = await currentPartnerId();
      if (pid) {
        const supabase = createClient();
        const { data: m } = await supabase
          .from("recruiting_mandates")
          .select("account_name, role")
          .eq("id", id)
          .maybeSingle();
        const mand = m as { account_name?: string; role?: string } | null;
        const accName = mand?.account_name ?? "";
        const accId = accName ? await resolveAccountId(supabase, accName) : null;
        const role = mand?.role || "Position";
        // Direkt (unabhängig von Automatisierungs-Schalter): Suche starten.
        await supabase.from("crm_tasks").insert({
          partner_id: pid,
          related_type: accId ? "customer" : "none",
          related_id: accId,
          related_label: `${accName} – ${role}`,
          title: `Suche starten – Sourcing: ${role} (Anzahlung erhalten)`,
          due_date: new Date().toISOString().slice(0, 10),
        });
        revalidatePath("/cockpit/aufgaben");
        revalidatePath("/cockpit/kalender");
        if (accId) revalidatePath(`/cockpit/kunden/${accId}`);
      }
    } catch (e) {
      logDataError("mandate:deposit_paid", e);
    }
  }
  return res;
}

/** Festpreis-Zahlungs-Gate: Restzahlung (bei Besetzung) als bezahlt markieren. */
export async function setMandateFinalPaid(id: string, paid: boolean): Promise<ActionResult> {
  return updateGraceful(
    "recruiting_mandates",
    id,
    {
      final_paid: paid,
      final_paid_at: paid ? new Date().toISOString().slice(0, 10) : null,
    },
    ["/cockpit/projekte/recruiting", `/cockpit/projekte/recruiting/${id}`]
  );
}

/**
 * Hält einen erstellten Vermittlungsvertrag beim Kunden fest: Korrespondenz-
 * Notiz + Vertragsstatus „versendet“ + letzte Aktivität. Materialisiert
 * virtuelle Accounts bei Bedarf.
 */
export async function recordContractCreated(
  accountId: string,
  summary: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const realId = (await materializeAccount(supabase, pid, accountId)) ?? accountId;

  const { error: noteErr } = await supabase
    .from("account_notes")
    .insert({ partner_id: pid, account_id: realId, body: summary });
  if (noteErr) return { ok: false, error: noteErr.message };

  // Vertragsstatus „versendet“ + letzte Aktivität (graceful).
  await supabase
    .from("accounts")
    .update({ contract_status: "versendet", last_activity_at: new Date().toISOString() })
    .eq("id", realId);

  revalidatePath(`/cockpit/kunden/${realId}`);
  revalidatePath("/cockpit/kunden");
  return { ok: true };
}

/**
 * Setzt den Vertragsstatus auf „versendet“ (z. B. nach Versand der Vertrags-
 * Mail). Überschreibt einen bereits „unterzeichnet“-Status nicht. Aktualisiert
 * die letzte Aktivität. Materialisiert virtuelle Accounts bei Bedarf.
 */
export async function markContractSent(accountId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const realId = (await materializeAccount(supabase, pid, accountId)) ?? accountId;

  const { data } = await supabase.from("accounts").select("contract_status").eq("id", realId).maybeSingle();
  const cur = (data as { contract_status?: string } | null)?.contract_status;
  const patch: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  if (cur !== "unterzeichnet") patch.contract_status = "versendet";
  await supabase.from("accounts").update(patch).eq("id", realId);

  revalidatePath(`/cockpit/kunden/${realId}`);
  revalidatePath("/cockpit/kunden");
  return { ok: true };
}

/**
 * Vertrag unterschrieben: setzt Status „unterzeichnet“ + Datum, hält es als
 * Korrespondenz fest und aktiviert offene Angebots-Mandate des Kunden
 * (Status „angebot“ → „offen“). Materialisiert virtuelle Accounts.
 */
export async function markContractSigned(
  accountId: string
): Promise<ActionResult & { activated?: number }> {
  if (useMockData) return { ...DEMO, activated: 0 };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const realId = (await materializeAccount(supabase, pid, accountId)) ?? accountId;

  const { data: acc } = await supabase.from("accounts").select("name").eq("id", realId).maybeSingle();
  const accName = (acc as { name?: string } | null)?.name ?? "";

  await supabase
    .from("accounts")
    .update({
      contract_status: "unterzeichnet",
      contract_signed_at: new Date().toISOString().slice(0, 10),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", realId);
  await supabase
    .from("account_notes")
    .insert({ partner_id: pid, account_id: realId, body: "Vermittlungsvertrag unterschrieben." });

  // Angebots-Mandate des Kunden aktivieren.
  let activated = 0;
  if (accName) {
    const { data: ms } = await supabase
      .from("recruiting_mandates")
      .select("id")
      .ilike("account_name", accName)
      .eq("status", "angebot");
    const ids = ((ms as Array<{ id?: string }> | null) ?? []).map((m) => m.id).filter(Boolean) as string[];
    if (ids.length) {
      const { error: upErr } = await supabase.from("recruiting_mandates").update({ status: "offen" }).in("id", ids);
      if (!upErr) activated = ids.length;
    }
  }

  revalidatePath(`/cockpit/kunden/${realId}`);
  revalidatePath("/cockpit/projekte/recruiting");
  revalidatePath("/cockpit/kunden");
  return { ok: true, activated };
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
  const accountName = s(fd, "account_name");
  const res = await updateGraceful(
    "ki_projects",
    id,
    {
      account_name: accountName,
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
  if (res.ok && !res.demo) {
    try {
      await syncAccountMrr(createClient(), accountName);
    } catch {
      /* best effort */
    }
  }
  return res;
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
