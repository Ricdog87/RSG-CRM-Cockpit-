import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export interface EmailActivity {
  id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  snippet: string;
  occurred_at: string;
  account_id?: string | null;
}

/** Domain für die BCC-Adresse (track+<token>@<domain>). */
export const INBOUND_DOMAIN =
  process.env.EMAIL_INBOUND_DOMAIN || "inbox.rsg-crm.de";

function randomToken(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 14);
  return Math.random().toString(36).slice(2, 16);
}

/**
 * Liefert die persönliche BCC-Adresse der:des eingeloggten Partner:in
 * (legt den Token beim ersten Aufruf an). Im Demo-Modus ein fester Token.
 */
export async function getInboxAddress(): Promise<{
  address: string;
  token: string;
  demo: boolean;
}> {
  if (useMockData) {
    return { address: `track+demo@${INBOUND_DOMAIN}`, token: "demo", demo: true };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { address: "", token: "", demo: false };

  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!partner) return { address: "", token: "", demo: false };

  const { data: existing } = await supabase
    .from("partner_inbox")
    .select("token")
    .eq("partner_id", partner.id)
    .maybeSingle();

  let token = existing?.token as string | undefined;
  if (!token) {
    token = randomToken();
    await supabase
      .from("partner_inbox")
      .insert({ partner_id: partner.id, token });
  }

  return { address: `track+${token}@${INBOUND_DOMAIN}`, token, demo: false };
}

function mapRow(r: Record<string, unknown>): EmailActivity {
  return {
    id: String(r.id),
    direction: (r.direction as EmailActivity["direction"]) ?? "outbound",
    from_email: String(r.from_email ?? ""),
    from_name: String(r.from_name ?? ""),
    to_email: String(r.to_email ?? ""),
    subject: String(r.subject ?? "(kein Betreff)"),
    snippet: String(r.snippet ?? ""),
    occurred_at: String(r.occurred_at ?? ""),
    account_id: (r.account_id as string | null) ?? null,
  };
}

/** Letzte getrackte E-Mails der:des Partner:in. */
export async function getEmailActivities(limit = 25): Promise<EmailActivity[]> {
  if (useMockData) return mockEmails;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("email_activities")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/** Getrackte E-Mails zu einem Account (Korrespondenz-Timeline). */
export async function getEmailActivitiesForAccount(
  accountId: string,
  accountName?: string
): Promise<EmailActivity[]> {
  if (useMockData) {
    // Demo: zeige Beispiel-Korrespondenz auf der Detailseite.
    return mockEmails.map((m) => ({ ...m, account_id: accountId }));
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("email_activities")
      .select("*")
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map(mapRow);
  } catch {
    return [];
  }
}

const mockEmails: EmailActivity[] = [
  {
    id: "e1",
    direction: "outbound",
    from_email: "partner@recruiting-sg.de",
    from_name: "Du",
    to_email: "info@hofmann-dental.de",
    subject: "Angebot AI Account Manager",
    snippet: "Wie besprochen anbei unser Vorschlag für die KI-Telefonassistenz …",
    occurred_at: "2026-06-12T09:20:00Z",
  },
  {
    id: "e2",
    direction: "inbound",
    from_email: "info@hofmann-dental.de",
    from_name: "Praxis Hofmann",
    to_email: "partner@recruiting-sg.de",
    subject: "Re: Angebot AI Account Manager",
    snippet: "Vielen Dank, das sieht gut aus. Können wir Donnerstag telefonieren?",
    occurred_at: "2026-06-12T14:05:00Z",
  },
  {
    id: "e3",
    direction: "outbound",
    from_email: "partner@recruiting-sg.de",
    from_name: "Du",
    to_email: "info@hofmann-dental.de",
    subject: "Re: Angebot AI Account Manager",
    snippet: "Sehr gern – Donnerstag 11 Uhr passt mir. Ich rufe an.",
    occurred_at: "2026-06-12T15:30:00Z",
  },
];
