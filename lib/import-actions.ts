"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { findImportObject } from "@/lib/import-config";

export interface ImportResult {
  ok: boolean;
  demo?: boolean;
  error?: string;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const MAX_ROWS = 5000;
const REVALIDATE: Record<string, string> = {
  accounts: "/cockpit/kunden",
  candidates: "/cockpit/kandidaten",
  account_contacts: "/cockpit/kunden",
  ki_projects: "/cockpit/projekte/ki",
  recruiting_mandates: "/cockpit/projekte/recruiting",
};

function toNumber(v: string): number | null {
  if (!v) return null;
  let s = v.replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string): string | null {
  if (!v) return null;
  const de = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
  const iso = v.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toDateTime(v: string): string | null {
  if (!v) return null;
  // dd.mm.yyyy [hh:mm] → ISO
  const de = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (de) {
    const [, d, m, y, hh = "00", mm = "00"] = de;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:00`;
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const dt = new Date(v.replace(" ", "T"));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

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

export async function importRows(input: {
  object: string;
  mapping: Record<string, number>;
  dedupe: string;
  updateExisting: boolean;
  rows: string[][];
}): Promise<ImportResult> {
  const empty: ImportResult = { ok: true, created: 0, updated: 0, skipped: 0, errors: [] };
  const obj = findImportObject(input.object);
  if (!obj) return { ...empty, ok: false, error: "Unbekanntes Objekt." };
  if (input.rows.length === 0) return { ...empty, ok: false, error: "Keine Datenzeilen." };
  if (input.rows.length > MAX_ROWS)
    return { ...empty, ok: false, error: `Maximal ${MAX_ROWS} Zeilen pro Import – bitte aufteilen.` };

  // Zeilen → typisierte Datensätze gemäß Mapping aufbauen.
  type Built = { idx: number; rec: Record<string, unknown>; dedupeVal: string };
  const built: Built[] = [];
  const errors: { row: number; message: string }[] = [];

  input.rows.forEach((row, i) => {
    const rec: Record<string, unknown> = {};
    let missingRequired: string | null = null;
    for (const f of obj.fields) {
      const col = input.mapping[f.key];
      const raw = col != null && col >= 0 ? String(row[col] ?? "").trim() : "";
      if (f.required && !raw) missingRequired = f.label;
      if (!raw) {
        rec[f.key] = null;
        continue;
      }
      rec[f.key] =
        f.type === "number"
          ? toNumber(raw)
          : f.type === "date"
            ? toDate(raw)
            : f.type === "datetime"
              ? toDateTime(raw)
              : raw;
    }
    if (missingRequired) {
      errors.push({ row: i + 2, message: `Pflichtfeld fehlt: ${missingRequired}` });
      return;
    }
    const idCol = input.mapping["id"];
    const idVal = idCol != null && idCol >= 0 ? String(row[idCol] ?? "").trim() : "";
    if (idVal) rec.id = idVal;
    const dedupeVal =
      input.dedupe === "id" ? idVal : input.dedupe ? String(rec[input.dedupe] ?? "").trim() : "";
    built.push({ idx: i + 2, rec, dedupeVal });
  });

  if (useMockData) {
    return { ok: true, demo: true, created: built.length, updated: 0, skipped: 0, errors };
  }

  const { id: pid, error: pErr } = await currentPartnerId();
  if (!pid) return { ...empty, ok: false, error: pErr, errors };
  const supabase = createClient();

  // Eltern-Auflösung (Account/Kandidat → id [+ Name]) über Name/E-Mail.
  let parentMap: Map<string, { id: string; name: string }> | null = null;
  if (obj.parentRef) {
    const cols = Array.from(new Set(["id", "name", ...obj.parentRef.matchColumns]));
    const { data } = await supabase.from(obj.parentRef.table).select(cols.join(", "));
    parentMap = new Map();
    for (const r of (data as unknown as Array<Record<string, unknown>>) ?? []) {
      const id = String(r.id);
      const name = String(r.name ?? "");
      for (const mc of obj.parentRef.matchColumns) {
        const val = String(r[mc] ?? "").trim().toLowerCase();
        if (val && !parentMap.has(val)) parentMap.set(val, { id, name });
      }
    }
  }

  // Dublettenschlüssel: vorhandene Werte → Datensatz-id vorab laden.
  const dedupeCol = input.dedupe === "id" ? "id" : input.dedupe;
  let existing: Map<string, string> | null = null;
  if (dedupeCol) {
    const sel = dedupeCol === "id" ? "id" : `id, ${dedupeCol}`;
    const { data, error } = await supabase.from(obj.table).select(sel);
    if (error)
      return { ...empty, ok: false, error: `Abgleich fehlgeschlagen: ${error.message}`, errors };
    existing = new Map(
      ((data as unknown as Array<Record<string, unknown>>) ?? [])
        .map((r) => [String(r[dedupeCol] ?? "").trim().toLowerCase(), String(r.id)] as const)
        .filter(([k]) => k !== "")
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const toInsert: { idx: number; rec: Record<string, unknown> }[] = [];
  const toUpdate: { idx: number; id: string; rec: Record<string, unknown> }[] = [];

  for (const b of built) {
    const rec = { ...b.rec, ...(obj.fixed ?? {}) };
    // virtuelles Eltern-Feld → id (+ Name) auflösen
    if (obj.parentRef) {
      const pr = obj.parentRef;
      const key = String(rec[pr.field] ?? "").trim().toLowerCase();
      const raw = String(b.rec[pr.field] ?? "");
      delete rec[pr.field];
      const hitParent = parentMap?.get(key);
      if (!hitParent) {
        errors.push({ row: b.idx, message: `${pr.table === "accounts" ? "Account" : "Kandidat:in"} nicht gefunden: ${raw}` });
        continue;
      }
      rec[pr.setId] = hitParent.id;
      if (pr.setLabel) rec[pr.setLabel] = hitParent.name;
    }
    const hit = existing && b.dedupeVal ? existing.get(b.dedupeVal.toLowerCase()) : undefined;
    if (hit) {
      if (input.updateExisting) {
        const patch = { ...rec };
        delete patch.id;
        toUpdate.push({ idx: b.idx, id: hit, rec: patch });
      } else {
        skipped++;
      }
    } else {
      const insertRec = { ...rec };
      delete insertRec.id; // id immer von der DB generieren lassen
      insertRec.partner_id = pid;
      toInsert.push({ idx: b.idx, rec: insertRec });
    }
  }

  // Inserts in Blöcken.
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await supabase.from(obj.table).insert(chunk.map((c) => c.rec));
    if (error) {
      // Block fehlgeschlagen → Zeilen einzeln versuchen, um die guten zu retten.
      for (const c of chunk) {
        const { error: e2 } = await supabase.from(obj.table).insert(c.rec);
        if (e2) errors.push({ row: c.idx, message: e2.message });
        else created++;
      }
    } else {
      created += chunk.length;
    }
  }

  // Updates einzeln (RLS-scoped über id).
  for (const u of toUpdate) {
    const { error } = await supabase.from(obj.table).update(u.rec).eq("id", u.id);
    if (error) errors.push({ row: u.idx, message: error.message });
    else updated++;
  }

  revalidatePath(REVALIDATE[obj.key] ?? "/cockpit");
  return { ok: true, created, updated, skipped, errors };
}
