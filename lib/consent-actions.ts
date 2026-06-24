"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { useMockData } from "@/lib/env";
import { consentEmail } from "@/lib/consent-email";
import type { ActionResult } from "@/lib/crm-actions";

/**
 * DSGVO-Einwilligungen: anfordern (E-Mail an Kandidat:in via n8n→Gmail),
 * erteilen und widerrufen. Das Erteilen/Widerrufen läuft öffentlich (ohne
 * Login) über den Service-Role-Client + Token; protokolliert Zeitstempel,
 * IP und User-Agent als Nachweis.
 */
const TEXT_VERSION = "v1-2026-06";
const LINK_TTL_DAYS = 30;

function newToken(): string {
  const r = () => crypto.randomUUID().replace(/-/g, "");
  return (r() + r()).slice(0, 48);
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://rsg-crm-cockpit.vercel.app"
  ).replace(/\/$/, "");
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

type ConsentPurpose = "PROFIL_SPEICHERN" | "VERMITTLUNG" | "WEITERGABE_AN_KUNDE";

/** Erzeugt eine Einwilligungs-Anfrage und schickt dem/der Kandidat:in den Link per E-Mail. */
export async function requestConsent(
  candidateId: string,
  zweck: ConsentPurpose = "VERMITTLUNG"
): Promise<ActionResult & { link?: string; emailed?: boolean }> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { data: cand, error: selErr } = await supabase
    .from("candidates")
    .select("name, email")
    .eq("id", candidateId)
    .maybeSingle();
  if (selErr || !cand) return { ok: false, error: selErr?.message ?? "Kandidat:in nicht gefunden." };
  const email = (cand as { email?: string }).email;
  const name = (cand as { name?: string }).name ?? "";
  if (!email) return { ok: false, error: "Keine E-Mail-Adresse hinterlegt – bitte zuerst ergänzen." };

  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + LINK_TTL_DAYS * 86400000);

  const { error: insErr } = await supabase.from("candidate_consents").insert({
    candidate_id: candidateId,
    partner_id: pid,
    token,
    status: "pending",
    zweck,
    rechtsgrundlage: "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)",
    nachweis: "Double-Opt-In per E-Mail-Link",
    text_version: TEXT_VERSION,
    email_to: email,
    sent_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });
  if (insErr) return { ok: false, error: insErr.message };

  const link = `${appBaseUrl()}/einwilligung/${token}`;

  let emailed = false;
  const hook = process.env.CONSENT_EMAIL_WEBHOOK_URL;
  if (hook) {
    try {
      const { subject, html } = consentEmail({ name, link });
      const res = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, subject, html }),
      });
      emailed = res.ok;
    } catch {
      emailed = false;
    }
  }

  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true, link, emailed };
}

function clientMeta(): { ip: string | null; ua: string | null } {
  const h = headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent");
  return { ip, ua };
}

interface ConsentReq {
  id: string;
  candidate_id: string;
  partner_id: string;
  zweck: string | null;
  status: string;
  expires_at: string | null;
  email_to: string | null;
}

/** Jüngsten Consent-Record für (Kandidat, Zweck) holen – Append-only-Kette. */
async function latestForPurpose(
  svc: ReturnType<typeof createServiceClient>,
  candidateId: string,
  zweck: string | null
): Promise<{ status: string; granted_at: string | null } | null> {
  let q = svc
    .from("candidate_consents")
    .select("status, granted_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(1);
  q = zweck === null ? q.is("zweck", null) : q.eq("zweck", zweck);
  const { data } = await q.maybeSingle();
  return (data as { status: string; granted_at: string | null } | null) ?? null;
}

/**
 * Einwilligung erteilen (öffentlich, per Token). Append-only: legt einen NEUEN
 * Record an (supersedes_id auf die Anfrage), überschreibt nichts. Protokolliert
 * Zeit/IP/UA als Nachweis.
 */
export async function grantConsent(
  token: string
): Promise<{ ok: boolean; error?: string; granted_at?: string }> {
  if (!hasServiceRole()) return { ok: false, error: "Service nicht verfügbar." };
  const svc = createServiceClient();
  const { data: row } = await svc
    .from("candidate_consents")
    .select("id, candidate_id, partner_id, zweck, status, expires_at, email_to")
    .eq("token", token)
    .maybeSingle();
  if (!row) return { ok: false, error: "Ungültiger oder abgelaufener Link." };
  const r = row as ConsentReq;

  // Idempotent: bereits erteilt?
  const latest = await latestForPurpose(svc, r.candidate_id, r.zweck);
  if (latest?.status === "granted") {
    return { ok: true, granted_at: latest.granted_at ?? undefined };
  }
  if (r.expires_at && new Date(r.expires_at) < new Date()) {
    return { ok: false, error: "Dieser Link ist abgelaufen. Bitte fordern Sie einen neuen an." };
  }

  const { ip, ua } = clientMeta();
  const now = new Date().toISOString();
  const { error } = await svc.from("candidate_consents").insert({
    candidate_id: r.candidate_id,
    partner_id: r.partner_id,
    zweck: r.zweck,
    token: newToken(),
    status: "granted",
    granted_at: now,
    supersedes_id: r.id,
    rechtsgrundlage: "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)",
    nachweis: "Bestätigung über Einwilligungs-Link",
    text_version: TEXT_VERSION,
    email_to: r.email_to,
    ip_address: ip,
    user_agent: ua,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, granted_at: now };
}

/**
 * Einwilligung widerrufen (öffentlich, per Token). Append-only: neuer Record
 * mit Status revoked (supersedes_id auf die Anfrage).
 */
export async function revokeConsent(
  token: string
): Promise<{ ok: boolean; error?: string; revoked_at?: string }> {
  if (!hasServiceRole()) return { ok: false, error: "Service nicht verfügbar." };
  const svc = createServiceClient();
  const { data: row } = await svc
    .from("candidate_consents")
    .select("id, candidate_id, partner_id, zweck, status, expires_at, email_to")
    .eq("token", token)
    .maybeSingle();
  if (!row) return { ok: false, error: "Ungültiger Link." };
  const r = row as ConsentReq;

  const { ip, ua } = clientMeta();
  const now = new Date().toISOString();
  const { error } = await svc.from("candidate_consents").insert({
    candidate_id: r.candidate_id,
    partner_id: r.partner_id,
    zweck: r.zweck,
    token: newToken(),
    status: "revoked",
    revoked_at: now,
    supersedes_id: r.id,
    text_version: TEXT_VERSION,
    email_to: r.email_to,
    ip_address: ip,
    user_agent: ua,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, revoked_at: now };
}
