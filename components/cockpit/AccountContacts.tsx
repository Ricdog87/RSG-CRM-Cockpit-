"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconUsers, IconTrash } from "@/components/ui/icons";
import { addContact, deleteContact } from "@/lib/crm-actions";
import type { Contact } from "@/lib/contacts-data";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

export function AccountContacts({
  accountId,
  contacts,
}: {
  accountId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Contact[]>(contacts);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const name = useRef<HTMLInputElement>(null);
  const role = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const phone = useRef<HTMLInputElement>(null);

  function add() {
    const n = name.current?.value.trim();
    if (!n) return;
    const c: Contact = {
      id: `tmp-${Date.now()}`,
      name: n,
      role: role.current?.value.trim() ?? "",
      email: email.current?.value.trim() ?? "",
      phone: phone.current?.value.trim() ?? "",
    };
    setItems((p) => [...p, c]);
    setOpen(false);
    [name, role, email, phone].forEach((r) => r.current && (r.current.value = ""));
    start(async () => {
      const res = await addContact(accountId, {
        name: c.name,
        role: c.role,
        email: c.email,
        phone: c.phone,
      });
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) setItems((p) => p.filter((x) => x.id !== c.id));
    });
  }

  function remove(id: string) {
    setItems((p) => p.filter((x) => x.id !== id));
    start(async () => {
      const res = await deleteContact(id, accountId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Ansprechpartner:innen"
          action={
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-xs font-semibold text-brand-deep hover:text-brand-ink"
            >
              {open ? "Schließen" : "+ Kontakt"}
            </button>
          }
        />

        {open ? (
          <div className="mb-4 grid gap-2 rounded-xl border border-border bg-elevated/40 p-3 sm:grid-cols-2">
            <input ref={name} placeholder="Name *" className={inputClass} />
            <input ref={role} placeholder="Rolle (z.B. Inhaber)" className={inputClass} />
            <input ref={email} type="email" placeholder="E-Mail" className={inputClass} />
            <input ref={phone} placeholder="Telefon" className={inputClass} />
            <div className="flex justify-end sm:col-span-2">
              <Button onClick={add} disabled={pending}>
                Kontakt speichern
              </Button>
            </div>
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="Noch keine Ansprechpartner:innen. Füge die Kontakte dieses Accounts hinzu."
            icon={<IconUsers size={22} />}
          />
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand/25 to-sky/25 text-sm font-bold text-ink">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.name}
                    {c.role ? <span className="text-faint"> · {c.role}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Kontakt löschen"
                  onClick={() => remove(c.id)}
                  className="flex-none rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                >
                  <IconTrash size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
