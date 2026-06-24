import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

/**
 * Read-only Zugriff auf die gespiegelten HubSpot-Recruiting-Projekte
 * (`project_refs`). Source of Truth ist HubSpot – diese Tabelle wird nur
 * durch den Sync (lib/hubspot) befüllt, hier wird ausschließlich gelesen.
 */
export interface ProjectRef {
  id: string;
  hubspot_deal_id: string;
  titel: string | null;
  kunde: string | null;
  anforderungen: string | null;
  skills: string[];
  standort: string | null;
  status: string | null;
  hubspot_pipeline: string | null;
  hubspot_stage: string | null;
  last_synced_at: string | null;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (v == null ? null : String(v));

function mapRow(r: Row): ProjectRef {
  return {
    id: String(r.id),
    hubspot_deal_id: String(r.hubspot_deal_id),
    titel: str(r.titel),
    kunde: str(r.kunde),
    anforderungen: str(r.anforderungen),
    skills: Array.isArray(r.skills) ? (r.skills as string[]) : [],
    standort: str(r.standort),
    status: str(r.status),
    hubspot_pipeline: str(r.hubspot_pipeline),
    hubspot_stage: str(r.hubspot_stage),
    last_synced_at: str(r.last_synced_at),
  };
}

/** Alle gespiegelten Projekte (RLS: eigene + Downline). */
export async function getProjectRefs(): Promise<ProjectRef[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_refs")
      .select("*")
      .order("last_synced_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return (data as Row[]).map(mapRow);
  } catch {
    return [];
  }
}

/** Einzelnes gespiegeltes Projekt. */
export async function getProjectRef(id: string): Promise<ProjectRef | null> {
  if (useMockData) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_refs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return mapRow(data as Row);
  } catch {
    return null;
  }
}
