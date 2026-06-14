import "server-only";
import { createClient as createSb } from "@supabase/supabase-js";

/**
 * Service-Role-Client – NUR serverseitig (Webhooks/Backend), NIEMALS im
 * Frontend. Umgeht RLS und schreibt z.B. eingehende E-Mails (analog n8n).
 * Key kommt aus SUPABASE_SERVICE_ROLE_KEY (server-only, kein NEXT_PUBLIC).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function hasServiceRole(): boolean {
  return url.startsWith("http") && serviceKey.length > 0;
}

export function createServiceClient() {
  return createSb(url, serviceKey, { auth: { persistSession: false } });
}
