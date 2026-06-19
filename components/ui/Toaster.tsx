"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT, type ToastPayload, type ToastTone } from "@/lib/toast";

const toneStyle: Record<ToastTone, { bar: string; icon: string; label: string }> = {
  success: { bar: "bg-success", icon: "text-success", label: "Erfolg" },
  error: { bar: "bg-danger", icon: "text-danger", label: "Fehler" },
  info: { bar: "bg-sky", icon: "text-sky-deep", label: "Hinweis" },
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  if (tone === "error")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 16v-4M12 8h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

const DURATION = 4500;

/** Globaler Toast-Stack (rechts unten). Hört auf window-Events von lib/toast. */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const t = (e as CustomEvent<ToastPayload>).detail;
      if (!t?.message) return;
      setToasts((prev) => [...prev.slice(-3), t]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, DURATION);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-[120] flex w-[min(92vw,22rem)] flex-col gap-2 sm:bottom-4"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const s = toneStyle[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="animate-fade-up pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-xl border border-border bg-surface/95 px-3 py-2.5 pl-4 shadow-2xl backdrop-blur"
          >
            <span aria-hidden className={`absolute left-0 top-0 h-full w-1 ${s.bar}`} />
            <span className={`mt-0.5 flex-none ${s.icon}`}>
              <ToastIcon tone={t.tone} />
            </span>
            <p className="min-w-0 flex-1 break-words text-sm text-ink">{t.message}</p>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Schließen"
              className="-mr-1 flex-none rounded-md p-0.5 text-faint transition-colors hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
