import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export interface KiMetric {
  id: string;
  project_id: string;
  period: string; // yyyy-mm
  calls?: number;
  automation_rate?: number;
  containment_rate?: number;
  escalations?: number;
  avg_handle_seconds?: number;
  uptime?: number;
  tokens?: number;
  token_cost?: number;
  csat?: number;
  notes?: string;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const numOpt = (v: unknown): number | undefined => (v == null ? undefined : Number(v));

function mapMetric(r: Row): KiMetric {
  return {
    id: str(r.id),
    project_id: str(r.project_id),
    period: str(r.period),
    calls: numOpt(r.calls),
    automation_rate: numOpt(r.automation_rate),
    containment_rate: numOpt(r.containment_rate),
    escalations: numOpt(r.escalations),
    avg_handle_seconds: numOpt(r.avg_handle_seconds),
    uptime: numOpt(r.uptime),
    tokens: numOpt(r.tokens),
    token_cost: numOpt(r.token_cost),
    csat: numOpt(r.csat),
    notes: str(r.notes) || undefined,
  };
}

/** Monatliche Metriken eines Projekts (neueste zuerst). */
export async function getMetricsForProject(projectId: string): Promise<KiMetric[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ki_metrics")
      .select("*")
      .eq("project_id", projectId)
      .order("period", { ascending: false });
    if (error || !data) return [];
    return (data as Row[]).map(mapMetric);
  } catch {
    return [];
  }
}
