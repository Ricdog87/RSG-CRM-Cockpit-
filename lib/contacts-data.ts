import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { logDataError, isMissingTable } from "@/lib/log";

export interface Contact {
  id: string;
  salutation: string;
  title: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  /** Freie Schlagworte zur Kategorisierung des Kontakts. */
  tags: string[];
  /** Gesetzt, wenn die E-Mail dieses Kontakts zu einem Kandidaten passt
   *  („Auch Kandidat") – verlinkt auf die Kandidaten-Detailseite. */
  candidate_id?: string;
}

/** Normalisierter E-Mail-Schlüssel (getrimmt, klein) für den Abgleich. */
function emailKey(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

/**
 * Lädt eine Map E-Mail → Kandidaten-ID für den Partner (eine Query). Grundlage
 * für die Auto-Erkennung „Auch Kandidat" bei Kontakten. RLS-scoped; best effort
 * (blockiert die Kontaktliste nie).
 */
async function candidateEmailMap(
  supabase: ReturnType<typeof createClient>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, email")
      .not("email", "is", null)
      .limit(5000);
    if (error) {
      if (!isMissingTable(error)) logDataError("contacts-data:candidates", error);
      return map;
    }
    for (const r of (data as Array<Record<string, unknown>>) ?? []) {
      const key = emailKey(r.email);
      if (key && !map.has(key)) map.set(key, String(r.id));
    }
  } catch (e) {
    logDataError("contacts-data:candidates", e);
  }
  return map;
}

/** Ansprechpartner:innen eines Accounts (inkl. Tags + „Auch Kandidat"-Abgleich). */
export async function getContactsForAccount(accountId: string): Promise<Contact[]> {
  if (useMockData) return mockContacts;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("account_contacts")
      .select("id, salutation, title, name, role, email, phone, tags")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      if (!isMissingTable(error)) logDataError("contacts-data:account_contacts", error);
      return [];
    }
    const rows = (data as Array<Record<string, unknown>>) ?? [];

    // Kandidaten-E-Mails nur laden, wenn überhaupt Kontakte mit E-Mail existieren.
    const hasEmails = rows.some((r) => emailKey(r.email));
    const byEmail = hasEmails ? await candidateEmailMap(supabase) : new Map<string, string>();

    return rows.map((r) => {
      const email = String(r.email ?? "");
      const candidate_id = byEmail.get(emailKey(email)) || undefined;
      return {
        id: String(r.id),
        salutation: String(r.salutation ?? ""),
        title: String(r.title ?? ""),
        name: String(r.name ?? ""),
        role: String(r.role ?? ""),
        email,
        phone: String(r.phone ?? ""),
        tags: Array.isArray(r.tags)
          ? (r.tags as unknown[]).map((t) => String(t)).filter(Boolean)
          : [],
        candidate_id,
      };
    });
  } catch (e) {
    logDataError("contacts-data:account_contacts", e);
    return [];
  }
}

const mockContacts: Contact[] = [
  { id: "c1", salutation: "Herr", title: "Dr.", name: "Martin Hofmann", role: "Inhaber", email: "m.hofmann@hofmann-dental.de", phone: "+49 511 123456", tags: ["Entscheider"] },
  { id: "c2", salutation: "Frau", title: "", name: "Sabine Krause", role: "Praxismanagerin", email: "s.krause@hofmann-dental.de", phone: "+49 511 123457", tags: [] },
];
