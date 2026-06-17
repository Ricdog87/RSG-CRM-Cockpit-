import "server-only";
import { getCandidates } from "@/lib/crm-data";
import { getConsents } from "@/lib/consent-data";

export interface RetentionItem {
  candidate_id: string;
  name: string;
  reason: string;
  since?: string;
}

/** Standard-Aufbewahrungsfrist ohne Einwilligung (Monate). */
export const RETENTION_MONTHS = 24;

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Kandidat:innen mit fälliger Löschung/Anonymisierung:
 *  • erteilte Einwilligung abgelaufen, ODER
 *  • keine erteilte Einwilligung und seit > RETENTION_MONTHS inaktiv.
 */
export async function getDeletionDue(retentionMonths = RETENTION_MONTHS): Promise<RetentionItem[]> {
  const [candidates, consents] = await Promise.all([getCandidates(), getConsents()]);
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = monthsAgo(retentionMonths);

  // Neueste Einwilligung je Kandidat:in (getConsents ist absteigend sortiert).
  const latest = new Map<string, { status: string; expires_at: string | null }>();
  for (const c of consents) {
    if (!latest.has(c.candidate_id)) latest.set(c.candidate_id, { status: c.status, expires_at: c.expires_at });
  }

  const due: RetentionItem[] = [];
  for (const cand of candidates) {
    const con = latest.get(cand.id);
    if (con?.status === "granted") {
      if (con.expires_at && con.expires_at < today) {
        due.push({ candidate_id: cand.id, name: cand.name, reason: "Einwilligung abgelaufen", since: con.expires_at });
      }
      continue; // gültige Einwilligung → behalten
    }
    // keine erteilte Einwilligung → Aufbewahrungsfrist prüfen
    const updated = cand.updated_at?.slice(0, 10) ?? "";
    if (updated && updated < cutoff) {
      due.push({
        candidate_id: cand.id,
        name: cand.name,
        reason: `Keine Einwilligung · inaktiv seit ${retentionMonths} Mon.`,
        since: updated,
      });
    }
  }
  due.sort((a, b) => (a.since ?? "").localeCompare(b.since ?? ""));
  return due;
}
