import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * HubSpot → RSG-CRM **read-only** Sync der Recruiting-Deals in project_refs.
 *
 * Einseitig: liest nur aus HubSpot (Read-Scopes) und upsertet in project_refs.
 * Es wird NIE nach HubSpot geschrieben und es werden KEINE Kandidaten gepusht.
 * Manuell triggerbar (Route /api/hubspot/sync-projects); Cron/n8n später.
 *
 * Benötigte HubSpot-Private-App-Read-Scopes:
 *   crm.objects.deals.read, crm.schemas.deals.read
 *   (optional: crm.objects.companies.read, crm.objects.contacts.read)
 *
 * Konfiguration via ENV (Property-Namen je nach eurem HubSpot-Schema):
 *   HUBSPOT_PRIVATE_APP_TOKEN   (Pflicht)
 *   HUBSPOT_RECRUITING_PIPELINE (optional – nur diese Pipeline syncen)
 *   HUBSPOT_PROP_STANDORT, HUBSPOT_PROP_ANFORDERUNGEN,
 *   HUBSPOT_PROP_SKILLS, HUBSPOT_PROP_KUNDE (optional – Custom-Properties)
 */

const HS_BASE = "https://api.hubapi.com";

export interface SyncResult {
  ok: boolean;
  error?: string;
  /** Genaue Scope-/Setup-Hinweise, falls Token fehlt. */
  setup?: string[];
  synced?: number;
}

async function currentPartnerId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  return data ? (data.id as string) : null;
}

interface HsDeal {
  id: string;
  properties: Record<string, string | null>;
}

/** Holt alle (offenen) Recruiting-Deals seitenweise aus HubSpot. */
async function fetchDeals(token: string): Promise<HsDeal[]> {
  const propStandort = process.env.HUBSPOT_PROP_STANDORT;
  const propAnf = process.env.HUBSPOT_PROP_ANFORDERUNGEN;
  const propSkills = process.env.HUBSPOT_PROP_SKILLS;
  const propKunde = process.env.HUBSPOT_PROP_KUNDE;
  const props = [
    "dealname",
    "pipeline",
    "dealstage",
    propStandort,
    propAnf,
    propSkills,
    propKunde,
  ].filter(Boolean) as string[];

  const out: HsDeal[] = [];
  let after: string | undefined;
  for (let page = 0; page < 50; page++) {
    const url = new URL(`${HS_BASE}/crm/v3/objects/deals`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", props.join(","));
    url.searchParams.set("archived", "false");
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HubSpot ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      results?: HsDeal[];
      paging?: { next?: { after?: string } };
    };
    out.push(...(json.results ?? []));
    after = json.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

function isOpen(stage: string | null): boolean {
  const s = (stage ?? "").toLowerCase();
  return !s.includes("closedwon") && !s.includes("closedlost");
}

function splitSkills(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[;,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Führt den read-only Sync aus (für den aktuell eingeloggten Partner). */
export async function syncHubspotProjects(): Promise<SyncResult> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    return {
      ok: false,
      error: "HUBSPOT_PRIVATE_APP_TOKEN ist nicht gesetzt – Sync nicht ausgeführt.",
      setup: [
        "1. HubSpot → Einstellungen → Integrationen → Private Apps → neue Private App anlegen.",
        "2. Scopes (Read): crm.objects.deals.read, crm.schemas.deals.read (optional: crm.objects.companies.read, crm.objects.contacts.read).",
        "3. Token kopieren und als ENV HUBSPOT_PRIVATE_APP_TOKEN hinterlegen (Vercel → Settings → Environment Variables).",
        "4. Optional: HUBSPOT_RECRUITING_PIPELINE + HUBSPOT_PROP_STANDORT/ANFORDERUNGEN/SKILLS/KUNDE für euer Deal-Schema setzen.",
      ],
    };
  }

  const pid = await currentPartnerId();
  if (!pid) return { ok: false, error: "Keine aktive Partner-Session." };

  let deals: HsDeal[];
  try {
    deals = await fetchDeals(token);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "HubSpot-Abruf fehlgeschlagen." };
  }

  const onlyPipeline = process.env.HUBSPOT_RECRUITING_PIPELINE || null;
  const propStandort = process.env.HUBSPOT_PROP_STANDORT;
  const propAnf = process.env.HUBSPOT_PROP_ANFORDERUNGEN;
  const propSkills = process.env.HUBSPOT_PROP_SKILLS;
  const propKunde = process.env.HUBSPOT_PROP_KUNDE;
  const now = new Date().toISOString();

  const rows = deals
    .filter((d) => isOpen(d.properties.dealstage))
    .filter((d) => !onlyPipeline || d.properties.pipeline === onlyPipeline)
    .map((d) => ({
      partner_id: pid,
      hubspot_deal_id: d.id,
      titel: d.properties.dealname ?? null,
      kunde: propKunde ? d.properties[propKunde] ?? null : null,
      anforderungen: propAnf ? d.properties[propAnf] ?? null : null,
      skills: propSkills ? splitSkills(d.properties[propSkills]) : [],
      standort: propStandort ? d.properties[propStandort] ?? null : null,
      status: d.properties.dealstage ?? null,
      hubspot_pipeline: d.properties.pipeline ?? null,
      hubspot_stage: d.properties.dealstage ?? null,
      raw: d.properties,
      last_synced_at: now,
      updated_at: now,
    }));

  if (rows.length === 0) return { ok: true, synced: 0 };

  const supabase = createClient();
  const { error } = await supabase
    .from("project_refs")
    .upsert(rows, { onConflict: "partner_id,hubspot_deal_id" });
  if (error) return { ok: false, error: error.message };

  return { ok: true, synced: rows.length };
}
