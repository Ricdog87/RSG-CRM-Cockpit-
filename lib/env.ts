/**
 * Zentrale, defensive ENV-Auswertung. Wenn die Supabase-ENV fehlen,
 * läuft das Cockpit im Mock-Modus weiter (Build/Preview bleibt grün).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const forceMock = process.env.NEXT_PUBLIC_COCKPIT_USE_MOCK === "true";

/** true ⇒ es wird gegen echte Supabase-Views gelesen */
export const isSupabaseConfigured =
  !forceMock &&
  SUPABASE_URL.startsWith("http") &&
  SUPABASE_ANON_KEY.length > 0;

/** true ⇒ Mock-Fallback aktiv (keine ENV oder erzwungen) */
export const useMockData = !isSupabaseConfigured;
