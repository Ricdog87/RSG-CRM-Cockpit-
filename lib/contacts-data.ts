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
}

/** Ansprechpartner:innen eines Accounts. */
export async function getContactsForAccount(accountId: string): Promise<Contact[]> {
  if (useMockData) return mockContacts;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("account_contacts")
      .select("id, salutation, title, name, role, email, phone")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      if (!isMissingTable(error)) logDataError("contacts-data:account_contacts", error);
      return [];
    }
    return ((data as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: String(r.id),
      salutation: String(r.salutation ?? ""),
      title: String(r.title ?? ""),
      name: String(r.name ?? ""),
      role: String(r.role ?? ""),
      email: String(r.email ?? ""),
      phone: String(r.phone ?? ""),
    }));
  } catch (e) {
    logDataError("contacts-data:account_contacts", e);
    return [];
  }
}

const mockContacts: Contact[] = [
  { id: "c1", salutation: "Herr", title: "Dr.", name: "Martin Hofmann", role: "Inhaber", email: "m.hofmann@hofmann-dental.de", phone: "+49 511 123456" },
  { id: "c2", salutation: "Frau", title: "", name: "Sabine Krause", role: "Praxismanagerin", email: "s.krause@hofmann-dental.de", phone: "+49 511 123457" },
];
