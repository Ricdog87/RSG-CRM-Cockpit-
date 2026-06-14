import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, useMockData } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const LOGIN_PATH = "/cockpit/login";

/**
 * Session-Refresh + Auth-Guard für die (cockpit)-Route-Group.
 * Ohne gültige Supabase-Session -> Redirect auf /cockpit/login.
 * Im Mock-Modus (keine ENV) wird der Guard übersprungen, damit die
 * Preview ohne echtes Auth-Setup durchläuft.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isLogin = path === LOGIN_PATH;

  // Mock-Modus: keine echte Auth verfügbar -> Cockpit offen lassen,
  // aber Login-Seite weiterhin direkt auf das Dashboard schicken.
  if (useMockData) {
    if (isLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/cockpit";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nicht eingeloggt und nicht auf der Login-Seite -> Redirect.
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // Bereits eingeloggt, aber auf der Login-Seite -> ins Cockpit.
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/cockpit";
    return NextResponse.redirect(url);
  }

  return response;
}
