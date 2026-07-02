import "server-only";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete } from "@/lib/ai/llm";

/**
 * Verarbeitet einen abgeschlossenen Fonio-Anruf (Eingangs-Webhook).
 * Findet den zugehörigen Anruf/Kandidaten, speichert Transkript/Outcome,
 * erzeugt per KI eine Kurz-Zusammenfassung und legt automatisch eine
 * Kandidaten-Notiz an → 0 Klicks nach dem Telefonat.
 *
 * Läuft ohne Session über den Service-Role-Client (Webhook ist extern).
 */

export interface FonioWebhookResult {
  ok: boolean;
  error?: string;
  candidateId?: string;
  summarized?: boolean;
  warning?: string;
}

function digits(s: unknown): string {
  return String(s ?? "").replace(/[^\d+]/g, "");
}
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] != null && obj[k] !== "") return obj[k];
  return null;
}

export async function processFonioCallResult(
  payload: Record<string, unknown>
): Promise<FonioWebhookResult> {
  if (!hasServiceRole()) return { ok: false, error: "Service-Role nicht verfügbar." };
  const svc = createServiceClient();

  const toNumber = digits(pick(payload, ["toNumber", "to_number", "to", "phone", "callee"]));
  const callRef = pick(payload, ["callId", "call_id", "id", "callRef", "uuid"]);
  const transcript = pick(payload, ["transcript", "text"]) as string | null;
  let summary = pick(payload, ["summary", "ai_summary"]) as string | null;
  const durationRaw = pick(payload, ["duration", "duration_seconds", "callDuration"]);
  const duration = durationRaw != null ? Number(durationRaw) || null : null;
  const outcome = pick(payload, ["outcome", "status", "disposition", "result"]) as string | null;

  // Zugehörigen Call/Kandidaten finden: per call_ref, sonst neuester Trigger an die Nummer.
  type Row = { id: string; partner_id: string; candidate_id: string | null };
  let row: Row | null = null;
  if (callRef) {
    const { data } = await svc
      .from("fonio_calls")
      .select("id, partner_id, candidate_id")
      .eq("call_ref", String(callRef))
      .maybeSingle();
    row = (data as Row | null) ?? null;
  }
  if (!row && toNumber) {
    // Fallback über die Nummer, aber nur innerhalb eines Zeitfensters (Anrufe
    // enden binnen Minuten) – begrenzt Fehlzuordnung zu alten Anrufen.
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data } = await svc
      .from("fonio_calls")
      .select("id, partner_id, candidate_id")
      .eq("to_number", toNumber)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as Row | null) ?? null;
  }
  if (!row) return { ok: false, error: "Kein zugehöriger Anruf/Kandidat gefunden." };

  // KI-Kurzzusammenfassung, falls Transkript da und keine Summary geliefert.
  let summarized = false;
  if (!summary && transcript && aiConfigured) {
    try {
      summary = await llmComplete(
        "Du bist Recruiting-Assistent. Fasse das folgende Telefonat in 3 knappen deutschen Sätzen zusammen: Kernergebnis, genannte Verfügbarkeit/Gehalt (falls erwähnt), konkreter nächster Schritt. Keine Floskeln, keine Anrede.",
        transcript.slice(0, 8000)
      );
      summarized = Boolean(summary && summary.trim());
    } catch {
      /* best effort – ohne Summary weiter */
    }
  }

  // Ergebnis am Anruf speichern (nur gesetzte Felder).
  const patch: Record<string, unknown> = { ended_at: new Date().toISOString(), status: "completed" };
  if (callRef) patch.call_ref = String(callRef);
  if (transcript) patch.transcript = transcript;
  if (summary) patch.summary = summary;
  if (duration != null) patch.duration_seconds = duration;
  if (outcome) patch.outcome = outcome;
  // Speichern ist fatal: bei Fehler ok:false → Route antwortet 4xx, Fonio retryt
  // (Update ist idempotent über row.id; die Notiz wird erst danach angelegt).
  const { error: updErr } = await svc.from("fonio_calls").update(patch).eq("id", row.id);
  if (updErr) return { ok: false, error: `Speichern fehlgeschlagen: ${updErr.message}` };

  // Automatische Kandidaten-Notiz (erscheint in der Aktivitäts-Timeline).
  let noteWarning: string | undefined;
  if (row.candidate_id) {
    const body = summary
      ? `Anruf-Zusammenfassung:\n${summary.trim()}`
      : `Anruf abgeschlossen${duration != null ? ` (${duration}s)` : ""}${outcome ? ` · ${outcome}` : ""}.`;
    const note = { partner_id: row.partner_id, candidate_id: row.candidate_id, body };
    const { error } = await svc.from("candidate_notes").insert({ ...note, kind: "call" });
    if (error) {
      if (/column .*kind.* does not exist/i.test(error.message)) {
        const { error: e2 } = await svc.from("candidate_notes").insert(note);
        if (e2) noteWarning = e2.message;
      } else {
        noteWarning = error.message;
      }
    }
  }

  // Notiz-Fehler NICHT fatal (Rohdaten sind gespeichert) – sonst Doppel-Notiz bei Retry.
  return { ok: true, candidateId: row.candidate_id ?? undefined, summarized, warning: noteWarning };
}
