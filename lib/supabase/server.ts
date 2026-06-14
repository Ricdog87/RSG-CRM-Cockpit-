import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase-Client für Server Components / Route Handler.
 * Nutzt ausschließlich den ANON-Key + die User-Session aus den Cookies.
 * RLS liefert automatisch nur eigene Daten + Downline.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Aufruf aus einer Server Component ohne Schreibrecht auf Cookies –
          // wird von der Middleware übernommen, daher hier ignorierbar.
        }
      },
    },
  });
}
