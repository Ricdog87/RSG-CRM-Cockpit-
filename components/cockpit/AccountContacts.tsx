"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconUsers, IconTrash, IconPencil } from "@/components/ui/icons";
import { addContact, updateContact, deleteContact } from "@/lib/crm-actions";
import type { Contact } from "@/lib/contacts-data";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

type Form = { salutation: string; title: string; name: string; role: string; email: string; phone: string };
const EMPTY: Form = { salutation: "", title: "", name: "", role: "", email: "", phone: "" };

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
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setOpen(true);
  }
  function openEdit(c: Contact) {
    setForm({ salutation: c.salutation, title: c.title, name: c.name, role: c.role, email: c.email, phone: c.phone });
    setEditId(c.id);
    setOpen(true);
  }

  function save() {
    const n = form.name.trim();
    if (!n) return;
    const payload = { ...form, name: n };
    const editing = editId;
    if (editing) {
      // optimistisch aktualisieren
      setItems((p) => p.map((x) => (x.id === editing ? { ...x, ...payload } : x)));
    } else {
      const tmp: Contact = { id: `tmp-${Date.now()}`, ...payload };
      setItems((p) => [...p, tmp]);
    }
    setOpen(false);
    setForm(EMPTY);
    setEditId(null);
    start(async () => {
      const res = editing
        ? await updateContact(editing, accountId, payload)
        : await addContact(accountId, payload);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        if (res.error) alert(res.error);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== id));
    start(async () => {
      const res = await deleteContact(id, accountId);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setItems(prev);
        if (res.error) alert(res.error);
      }
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
              onClick={() => (open ? setOpen(false) : openNew())}
              className="text-xs font-semibold text-brand-deep hover:text-brand-ink"
            >
              {open ? "Schließen" : "+ Kontakt"}
            </button>
          }
        />

        {open ? (
          <div className="mb-4 grid gap-2 rounded-xl border border-border bg-elevated/40 p-3 sm:grid-cols-2">
            <select value={form.salutation} onChange={set("salutation")} className={inputClass} aria-label="Anrede">
              <option value="">Anrede —</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
              <option value="Divers">Divers</option>
            </select>
            <input value={form.title} onChange={set("title")} placeholder="Titel (z.B. Dr.)" className={inputClass} />
            <input value={form.name} onChange={set("name")} placeholder="Name *" className={inputClass} />
            <input value={form.role} onChange={set("role")} placeholder="Rolle (z.B. Inhaber)" className={inputClass} />
            <input value={form.email} onChange={set("email")} type="email" placeholder="E-Mail" className={inputClass} />
            <input value={form.phone} onChange={set("phone")} placeholder="Telefon" className={inputClass} />
            <div className="flex justify-end sm:col-span-2">
              <Button onClick={save} disabled={pending}>
                {editId ? "Änderungen speichern" : "Kontakt speichern"}
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
                  {(c.name || "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {[c.salutation, c.title, c.name].filter(Boolean).join(" ")}
                    {c.role ? <span className="text-faint"> · {c.role}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Kontakt bearbeiten"
                    onClick={() => openEdit(c)}
                    className="rounded-lg p-1.5 text-faint hover:bg-elevated hover:text-ink"
                  >
                    <IconPencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Kontakt löschen"
                    onClick={() => remove(c.id)}
                    className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
