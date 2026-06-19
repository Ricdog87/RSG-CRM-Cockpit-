"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPhone, IconMail, IconCheck, IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { AccountCombobox } from "@/components/cockpit/AccountCombobox";
import { logActivity } from "@/lib/activity-actions";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";
const chip = "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60";

/**
 * Aktivitäts-Logger (Call/E-Mail) – mit Kundenanlage (Kaltakquise),
 * Korrespondenz-Sync und optionaler Wiedervorlage. Wiederverwendbar auf
 * Dashboard, KI- und Recruiting-Maske.
 */
export function ActivityLogger({
  accounts = [],
  lineLock,
  onLogged,
  defaultAccount = "",
}: {
  accounts?: string[];
  /** Wenn gesetzt: nur Call/E-Mail dieser Linie (KI- bzw. Recruiting-Maske). */
  lineLock?: "ki" | "recruiting";
  onLogged?: (kind: "call" | "email", line: "ki" | "recruiting") => void;
  /** Vorbelegung des Kunden (z.B. auf der Kundenmaske). */
  defaultAccount?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [account, setAccount] = useState(defaultAccount);
  const [subject, setSubject] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [followup, setFollowup] = useState(0);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const accTrim = account.trim();
  const isExisting = accTrim.length > 0 && accounts.some((a) => a.toLowerCase() === accTrim.toLowerCase());
  const isNewCustomer = accTrim.length > 0 && !isExisting;

  function log(kind: "call" | "email", line: "ki" | "recruiting") {
    setMsg(null);
    onLogged?.(kind, line);
    start(async () => {
      const res = await logActivity({
        kind,
        line,
        account_name: account,
        subject,
        contact_name: contact,
        contact_phone: phone,
        followupDays: followup,
      });
      if (!res.ok) {
        setMsg({ tone: "warn", text: res.error ?? "Fehlgeschlagen." });
        return;
      }
      setMsg(
        res.warning
          ? { tone: "warn", text: res.warning }
          : {
              tone: "ok",
              text: accTrim
                ? `Erfasst${isNewCustomer ? ` · Neukunde „${accTrim}" angelegt` : ` · beim Kunden hinterlegt`}${followup > 0 ? ` · Wiedervorlage in ${followup} T` : ""}.`
                : "Aktivität erfasst.",
            }
      );
      setAccount("");
      setSubject("");
      setContact("");
      setPhone("");
      if (!res.demo) router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <p className="text-xs font-semibold text-ink">Aktivität erfassen</p>
      <div className="grid grid-cols-2 gap-2">
        <AccountCombobox options={accounts} value={account} onValueChange={setAccount} placeholder="Kunde (für Korrespondenz)" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Thema (optional)" className={inputCls} />
      </div>

      {isNewCustomer ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Ansprechpartner:in (optional)" className={inputCls} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Telefon (optional)" className={inputCls} />
          </div>
          <p className="flex items-center gap-1.5 text-[0.7rem] text-brand-deep"><IconSpark size={12} className="flex-none" /> Neukunde „{accTrim}“ wird als Lead angelegt + Korrespondenz hinterlegt.</p>
        </>
      ) : isExisting ? (
        <p className="flex items-center gap-1.5 text-[0.7rem] text-success"><IconCheck size={12} className="flex-none" /> Wird beim Kunden „{accTrim}“ als Korrespondenz hinterlegt.</p>
      ) : null}

      {/* Wiedervorlage */}
      <label className="flex items-center gap-2 text-xs text-muted">
        Wiedervorlage:
        <select value={followup} onChange={(e) => setFollowup(Number(e.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink">
          <option value={0}>keine</option>
          <option value={1}>in 1 Tag</option>
          <option value={3}>in 3 Tagen</option>
          <option value={7}>in 7 Tagen</option>
          <option value={14}>in 14 Tagen</option>
        </select>
      </label>

      {/* Buttons */}
      {lineLock ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={() => log("call", lineLock)} className={cn(chip, "border-brand/40 bg-brand/10 text-brand-deep hover:bg-brand/15")}>
            <IconPhone size={12} className="mr-1 inline" /> Call erfassen
          </button>
          <button type="button" disabled={pending} onClick={() => log("email", lineLock)} className={cn(chip, "border-sky/40 bg-sky/10 text-sky-deep hover:bg-sky/15")}>
            <IconMail size={12} className="mr-1 inline" /> E-Mail erfassen
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-faint"><IconPhone size={12} /> Call:</span>
          <button type="button" disabled={pending} onClick={() => log("call", "ki")} className={cn(chip, "border-sky/40 bg-sky/10 text-sky-deep hover:bg-sky/15")}>+ KI</button>
          <button type="button" disabled={pending} onClick={() => log("call", "recruiting")} className={cn(chip, "border-brand/40 bg-brand/10 text-brand-deep hover:bg-brand/15")}>+ Recruiting</button>
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-faint"><IconMail size={12} /> E-Mail:</span>
          <button type="button" disabled={pending} onClick={() => log("email", "ki")} className={cn(chip, "border-sky/40 bg-sky/10 text-sky-deep hover:bg-sky/15")}>+ KI</button>
          <button type="button" disabled={pending} onClick={() => log("email", "recruiting")} className={cn(chip, "border-brand/40 bg-brand/10 text-brand-deep hover:bg-brand/15")}>+ Recruiting</button>
        </div>
      )}

      {msg ? <p className={cn("text-[0.7rem]", msg.tone === "ok" ? "text-success" : "text-danger")}>{msg.text}</p> : null}
    </div>
  );
}
