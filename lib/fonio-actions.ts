"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

/** Ergebnis einer KI-Anruf-Auslösung. */
export type CallResult = { ok: boolean; error?: string; demo?: boolean };

const FONIO_ENDPOINT = "https://app.fonio.ai/api/public/v1/outbound_call";

/**
 * Loest ueber die Fonio Outbound-API einen KI-Anruf an eine:n Kandidat:in aus.
 * Server-only: FONIO_API_KEY + FONIO_FROM_NUMBER kommen aus den (geheimen)
 * Vercel-Env-Variablen, niemals ins Frontend. Protokolliert den Versuch in
 * public.fonio_calls und als Aktivitaet (candidate_notes, kind="call").
 */
export async function requestAiCall(input: {
  candidateId: string;
  toPhone?: string | null;
}): Promise<CallResult> {
  if (useMockData) return { ok: true, demo: true };

  const apiKey = process.env.FONIO_API_KEY;
  const fromNumber = process.env.FONIO_FROM_NUMBER;
  if (!apiKey || !fromNumber) {
    return { ok: false, error: "Fonio nicht konfiguriert (FONIO_API_KEY / FONIO_FROM_NUMBER fehlen)." };
  }

  const to = String(input.toPhone ?? "").replace(/[^\d+]/g, "");
  if (!/^\+\d{6,}$/.test(to)) {
    return { ok: false, error: "Keine gueltige Telefonnummer (E.164, z.B. +49...) hinterlegt." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Keine aktive Session." };
  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  const partnerId = (partner as { id?: string } | null)?.id;
  if (!partnerId) return { ok: false, error: "Kein Partner-Profil gefunden." };

  const { data: cand } = await supabase
    .from("candidates")
    .select("name, role, salutation, title, email")
    .eq("id", input.candidateId)
    .single();
  const c = (cand as Record<string, unknown> | null) ?? {};
  const fullName = String(c.name ?? "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const context = {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
    full_name: fullName,
    role: String(c.role ?? ""),
    salutation: String(c.salutation ?? ""),
    title: String(c.title ?? ""),
    email: String(c.email ?? ""),
  };

  let fonioStatus = "";
  let message = "";
  let ok = false;
  try {
    const res = await fetch(FONIO_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ apiKey, fromNumber, toNumber: to, context }),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
    fonioStatus = String(data.status ?? res.status);
    message = String(data.message ?? "");
    ok = res.ok && data.status !== "error";
  } catch (e) {
    message = e instanceof Error ? e.message : "Fonio-Aufruf fehlgeschlagen.";
  }

  await supabase.from("fonio_calls").insert({
    partner_id: partnerId,
    candidate_id: input.candidateId,
    to_number: to,
    from_number: fromNumber,
    status: ok ? "triggered" : "error",
    fonio_status: fonioStatus || null,
    message: message || null,
  });

  const noteBody = ok
    ? `KI-Anruf ausgeloest an ${to}`
    : `KI-Anruf fehlgeschlagen (${message || fonioStatus || "unbekannt"})`;
  const note = { partner_id: partnerId, candidate_id: input.candidateId, body: noteBody };
  const { error: nErr } = await supabase.from("candidate_notes").insert({ ...note, kind: "call" });
  if (nErr && /column .*kind.* does not exist/i.test(nErr.message)) {
    await supabase.from("candidate_notes").insert(note);
  }

  revalidatePath(`/cockpit/kandidaten/${input.candidateId}`);
  return ok ? { ok: true } : { ok: false, error: message || "Fonio hat den Anruf nicht ausgeloest." };
}
