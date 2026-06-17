"use client";

import { useEffect, useRef, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

/**
 * Account-Auswahl mit Tippen + Vorschlägen. Erlaubt immer Freitext → neue
 * Kunden werden direkt angelegt. Ersetzt die unhandliche native datalist
 * (besonders bei tausenden Accounts auf Mobile).
 */
export function AccountCombobox({
  name,
  options,
  defaultValue = "",
  value,
  onValueChange,
  placeholder,
  required,
}: {
  name?: string;
  options: string[];
  defaultValue?: string;
  /** Controlled-Modus (z.B. Aktivitäts-Logger): value + onValueChange. */
  value?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const controlled = onValueChange !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const val = controlled ? value ?? "" : inner;
  const setVal = (v: string) => (controlled ? onValueChange!(v) : setInner(v));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const q = val.trim().toLowerCase();
  const matches = (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 8);
  const exact = options.some((o) => o.toLowerCase() === q);
  const showNew = q.length > 0 && !exact;

  return (
    <div ref={ref} className="relative">
      <input
        name={name}
        value={val}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setVal(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={inputClass}
      />
      {open && (matches.length > 0 || showNew) ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface shadow-card">
          {showNew ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-1.5 border-b border-border/60 px-3 py-2.5 text-left text-sm font-semibold text-brand-deep hover:bg-brand/5"
            >
              + Neuen Kunden anlegen: „{val.trim()}“
            </button>
          ) : null}
          {matches.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                setVal(o);
                setOpen(false);
              }}
              className="block w-full truncate px-3 py-2 text-left text-sm text-ink hover:bg-elevated"
            >
              {o}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
