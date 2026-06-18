"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { IconMail, IconCopy, IconCheck } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { EMAIL_TEMPLATES, buildGreeting } from "@/lib/email-templates";
import { logActivity } from "@/lib/activity-actions";
import { markContractSent } from "@/lib/crm-actions";
import type { Account } from "@/lib/crm-types";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

interface Recipient {
  id: string;
  label: string;
  email: string;
  salutation?: string;
  name?: string;
}

/**
 * E-Mail direkt aus dem CRM verfassen – Anrede automatisch aus den Kundendaten,
 * vorbereitete Vorlagen, Versand über das E-Mail-Programm (mailto). Wird als
 * Korrespondenz beim Kunden protokolliert.
 */
export function EmailComposer({
  account,
  contacts = [],
  senderName = "RSG Recruiting",
}: {
  account: Account;
  contacts?: { id: string; salutation: string; name: string; role: string; email: string }[];
  senderName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [sentContract, setSentContract] = useState(false);
  const [copied, setCopied] = useState(false);

  const recipients = useMemo<Recipient[]>(() => {
    const list: Recipient[] = [];
    if (account.contact_email || account.contact_name) {
      list.push({
        id: "main",
        label: `${account.contact_name || "Hauptkontakt"}${account.contact_email ? ` · ${account.contact_email}` : ""}`,
        email: account.contact_email,
        name: account.contact_name,
      });
    }
    for (const c of contacts) {
      list.push({
        id: c.id,
        label: `${c.name}${c.role ? ` (${c.role})` : ""}${c.email ? ` · ${c.email}` : ""}`,
        email: c.email,
        salutation: c.salutation,
        name: c.name,
      });
    }
    return list;
  }, [account, contacts]);

  const templatesForLine = useMemo(
    () => EMAIL_TEMPLATES.filter((t) => !t.line || t.line === account.line),
    [account.line]
  );

  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "main");
  const [templateKey, setTemplateKey] = useState(templatesForLine[0]?.key ?? EMAIL_TEMPLATES[0].key);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState(false);

  const recipient = recipients.find((r) => r.id === recipientId) ?? recipients[0];

  // Vorlage anwenden (Betreff/Text neu erzeugen).
  function applyTemplate(key: string, rcpt = recipient) {
    const tpl = EMAIL_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    const greeting = buildGreeting({ salutation: rcpt?.salutation, name: rcpt?.name });
    const { subject: s, body: b } = tpl.build({ greeting, company: account.name, senderName });
    setSubject(s);
    setBody(b);
    setTouched(false);
  }

  function openComposer() {
    setSent(false);
    applyTemplate(templateKey, recipients.find((r) => r.id === recipientId));
    setOpen(true);
  }

  const mailto = `mailto:${encodeURIComponent(recipient?.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  function sendAndLog() {
    // E-Mail-Programm öffnen …
    window.location.href = mailto;
    // … und als Korrespondenz protokollieren (zählt auch aufs Tagesziel).
    const tpl = EMAIL_TEMPLATES.find((t) => t.key === templateKey);
    start(async () => {
      const res = await logActivity({
        kind: "email",
        line: account.line,
        account_name: account.name,
        subject: subject || "E-Mail",
      });
      // Logischer Workflow: Vertrags-Mail → Vertragsstatus „versendet“.
      if (tpl?.marksContractSent) {
        await markContractSent(account.id);
      }
      if (res.ok) {
        setSent(true);
        setSentContract(Boolean(tpl?.marksContractSent));
        if (!res.demo) router.refresh();
      }
    });
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`Betreff: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openComposer}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sky/40 bg-sky/10 px-3 py-1.5 text-sm font-semibold text-sky-deep transition-colors hover:bg-sky/15"
      >
        <IconMail size={14} /> E-Mail schreiben
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="E-Mail an Kunden"
        description="Anrede & Empfänger kommen automatisch aus der Kundenmaske."
      >
        <div className="space-y-3">
          {/* Empfänger + Vorlage */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="kpi-label">Empfänger</span>
              <select
                value={recipientId}
                onChange={(e) => {
                  setRecipientId(e.target.value);
                  if (!touched) applyTemplate(templateKey, recipients.find((r) => r.id === e.target.value));
                }}
                className={cn(inputCls, "mt-1")}
              >
                {recipients.length === 0 ? <option value="main">— kein Kontakt hinterlegt —</option> : null}
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="kpi-label">Vorlage</span>
              <select
                value={templateKey}
                onChange={(e) => {
                  setTemplateKey(e.target.value);
                  applyTemplate(e.target.value);
                }}
                className={cn(inputCls, "mt-1")}
              >
                {templatesForLine.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="kpi-label">Betreff</span>
            <input value={subject} onChange={(e) => { setSubject(e.target.value); setTouched(true); }} className={cn(inputCls, "mt-1")} />
          </label>
          <label className="block">
            <span className="kpi-label">Text</span>
            <textarea value={body} onChange={(e) => { setBody(e.target.value); setTouched(true); }} rows={11} className={cn(inputCls, "mt-1 resize-y leading-relaxed")} />
          </label>

          {!recipient?.email ? (
            <p className="text-xs text-warning">Keine E-Mail-Adresse hinterlegt – bitte beim Kontakt ergänzen oder oben kopieren.</p>
          ) : null}
          {sent ? (
            <p className="rounded-lg border border-success/30 bg-success/[0.06] px-3 py-2 text-xs text-success">
              ✓ E-Mail-Programm geöffnet · beim Kunden als Korrespondenz protokolliert.
              {sentContract ? " Vertragsstatus → „versendet“ gesetzt." : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
            <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-elevated/70">
              {copied ? <IconCheck size={13} className="text-success" /> : <IconCopy size={13} />} {copied ? "Kopiert" : "Kopieren"}
            </button>
            <button
              type="button"
              onClick={sendAndLog}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-4 py-1.5 text-sm font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
            >
              <IconMail size={14} /> In E-Mail-Programm öffnen
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
