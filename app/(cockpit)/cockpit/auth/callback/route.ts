import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-Link / OAuth Callback. Tauscht den ?code gegen eine Session und
 * leitet anschließend ins Cockpit (oder das ursprüngliche Ziel) weiter.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") ?? "/cockpit";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/cockpit/login?error=auth_callback_failed`
  );
}
