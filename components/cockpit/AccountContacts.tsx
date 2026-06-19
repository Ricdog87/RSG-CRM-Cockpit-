"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconUsers, IconTrash, IconPencil, IconCopy, IconUserCheck, IconClose } from "@/components/ui/icons";
import { addContact, updateContact, deleteContact, setContactTags } from "@/lib/crm-actions";
import type { Contact } from "@/lib/contacts-data";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

type Form = { salutation: string; title: string; name: string; role: string; email: string; phone: string };
const EMPTY: Form = { salutation: "", title: "", name: "", role: "", email: "", phone: "" };
const ROLE_PRESETS = [
  "Geschäftsführung",
  "HR / Recruiting",
  "Fachbereich",
  "Einkauf",
  "Assistenz",
  "Technik / IT",
];

export function AccountContacts({
  accountId,
  contacts,
}: {
  accountId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Contact[]>(contacts);
  useEffect(() => setItems(contacts), [contacts]);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selected = useMemo(
    () => items.filter((c) => selectedIds.includes(c.id)),
    [items, selectedIds]
  );
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setSelectedIds((ids) => ids.filter((id) => items.some((c) => c.id === id)));
  }, [items]);

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
      const tmp: Contact = { id: `tmp-${Date.now()}`, ...payload, tags: [] };
      setItems((p) => [...p, tmp]);
    }
    setOpen(false);
    setForm(EMPTY);
    setEditId(null);
    start(async () => {
      const res = editing
        ? await updateContact(editing, accountId, payload)
        : await addContact(accountId, payload);
      if (res.ok && !res.demo) {
        toast.success(editing ? "Kontakt aktualisiert." : "Kontakt hinzugefügt.");
        if (res.redirect) router.replace(res.redirect);
        else router.refresh();
      } else if (!res.ok) {
        if (res.error) toast.error(res.error);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== id));
    setSelectedIds((ids) => ids.filter((x) => x !== id));
    start(async () => {
      const res = await deleteContact(id, accountId);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setItems(prev);
        if (res.error) toast.error(res.error);
      }
    });
  }

  function setTags(id: string, tags: string[]) {
    const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 20);
    const prev = items;
    setItems((p) => p.map((x) => (x.id === id ? { ...x, tags: clean } : x)));
    start(async () => {
      const res = await setContactTags(id, clean);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setItems(prev);
        if (res.error) toast.error(res.error);
      }
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  function mailSelected() {
    const emails = selected.map((c) => c.email).filter(Boolean);
    if (emails.length) window.location.href = `mailto:${emails.join(",")}`;
  }

  async function copySelected() {
    const text = selected
      .map((c) => [
        [c.salutation, c.title, c.name].filter(Boolean).join(" "),
        c.role ? `Funktion: ${c.role}` : "",
        c.email ? `E-Mail: ${c.email}` : "",
        c.phone ? `Telefon: ${c.phone}` : "",
      ].filter(Boolean).join(" · "))
      .join("\n");
    if (text) await navigator.clipboard?.writeText(text);
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
            <div>
              <input
                value={form.role}
                onChange={set("role")}
                list="account-contact-role-presets"
                placeholder="Funktion (z.B. HR / Recruiting)"
                className={inputClass}
              />
              <datalist id="account-contact-role-presets">
                {ROLE_PRESETS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
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
          <>
          <div className="mb-3 rounded-xl border border-border bg-elevated/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">Stakeholder-Auswahl</p>
                <p className="text-sm text-ink">
                  {selected.length
                    ? `${selected.length} Ansprechpartner:in${selected.length > 1 ? "nen" : ""} ausgewählt`
                    : "Wähle HR, Fachbereich, GF oder weitere Entscheider für den nächsten Schritt."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds(items.map((c) => c.id))}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink"
                >
                  Alle wählen
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  disabled={!selected.length}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink disabled:opacity-50"
                >
                  Auswahl löschen
                </button>
                <button
                  type="button"
                  onClick={copySelected}
                  disabled={!selected.length}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink disabled:opacity-50"
                >
                  <IconCopy size={12} /> Zusammenfassung kopieren
                </button>
                <button
                  type="button"
                  onClick={mailSelected}
                  disabled={!selected.some((c) => c.email)}
                  className="rounded-lg bg-brand-deep px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-ink disabled:opacity-50"
                >
                  E-Mail an Auswahl
                </button>
              </div>
            </div>
          </div>
          <ul className="space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  selectedIds.includes(c.id)
                    ? "border-brand/45 bg-brand/[0.06]"
                    : "border-border bg-elevated/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.id)}
                  onChange={() => toggleSelected(c.id)}
                  aria-label={`${c.name} auswählen`}
                  className="h-4 w-4 rounded border-border text-brand focus-visible:ring-2 focus-visible:ring-brand"
                />
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand/25 to-sky/25 text-sm font-bold text-ink">
                  {(c.name || "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium text-ink">
                    <span className="truncate">
                      {[c.salutation, c.title, c.name].filter(Boolean).join(" ")}
                      {c.role ? <span className="text-faint"> · {c.role}</span> : null}
                    </span>
                    {c.candidate_id ? (
                      <Link
                        href={`/cockpit/kandidaten/${c.candidate_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex flex-none items-center gap-1 rounded-full border border-sky/30 bg-sky/10 px-2 py-0.5 text-[11px] font-semibold text-sky-deep hover:bg-sky/20"
                        title="Dieser Kontakt ist auch als Kandidat:in erfasst"
                      >
                        <IconUserCheck size={11} /> Auch Kandidat
                      </Link>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <ContactTags
                    tags={c.tags}
                    disabled={pending}
                    onChange={(next) => setTags(c.id, next)}
                  />
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
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** Inline-Tag-Verwaltung pro Kontakt: Pills mit x zum Entfernen, Input + Enter
 *  zum Hinzufügen. Ruft beim Ändern den übergebenen onChange-Callback. */
function ContactTags({
  tags,
  disabled,
  onChange,
}: {
  tags: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");

  function add() {
    const t = value.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setValue("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((x) => x !== tag));
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand-deep"
        >
          {t}
          <button
            type="button"
            aria-label={`Tag ${t} entfernen`}
            onClick={() => removeTag(t)}
            disabled={disabled}
            className="rounded-full p-0.5 text-brand-deep/70 hover:bg-brand/20 hover:text-brand-deep disabled:opacity-50"
          >
            <IconClose size={10} />
          </button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        disabled={disabled}
        placeholder="+ Tag"
        aria-label="Tag hinzufügen"
        className="w-20 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-[11px] text-ink placeholder:text-faint focus-visible:w-28 focus-visible:border-brand focus-visible:outline-none disabled:opacity-50"
      />
    </div>
  );
}
