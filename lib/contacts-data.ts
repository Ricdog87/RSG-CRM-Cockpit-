import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export interface Contact {
  id: string;
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
      .select("id, name, role, email, phone")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      role: String(r.role ?? ""),
      email: String(r.email ?? ""),
      phone: String(r.phone ?? ""),
    }));
  } catch {
    return [];
  }
}

const mockContacts: Contact[] = [
  { id: "c1", name: "Dr. Martin Hofmann", role: "Inhaber", email: "m.hofmann@hofmann-dental.de", phone: "+49 511 123456" },
  { id: "c2", name: "Sabine Krause", role: "Praxismanagerin", email: "s.krause@hofmann-dental.de", phone: "+49 511 123457" },
];
