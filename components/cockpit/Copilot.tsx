"use client";

import { useRef, useState, useTransition } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { askCopilotAction } from "@/lib/ai-actions";

interface Msg {
  role: "user" | "assistant";
  text: string;
  mode?: "live" | "demo";
}

const SUGGESTIONS = [
  "Wie ist mein wiederkehrender Bestand?",
  "Welche Verkaufschance sollte ich zuerst angehen?",
  "Wie viele offene Stellen habe ich gerade?",
  "Warum ist mein Override pausiert?",
];

/** KI-Co-Pilot: Trigger in der Topbar + Chat-Dialog über das eigene CRM. */
export function Copilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    if (inputRef.current) inputRef.current.value = "";
    start(async () => {
      const res = await askCopilotAction(q);
      setMessages((m) => [
        ...m,
        res.ok
          ? { role: "assistant", text: res.answer ?? "", mode: res.mode }
          : { role: "assistant", text: res.error ?? "Fehler." },
      ]);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="KI fragen"
        className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15"
      >
        <IconSpark size={15} /> <span className="hidden sm:inline">KI fragen</span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="CRM Co-Pilot"
        description="Frag dein CRM in natürlicher Sprache."
      >
        <div className="flex max-h-[60vh] flex-col">
          <div className="min-h-[8rem] flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted">
                  Stell eine Frage zu deinem Bestand, deiner Pipeline oder deinem Team.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-full border border-border bg-elevated/60 px-3 py-1.5 text-xs text-muted hover:border-brand/40 hover:text-brand-deep"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                      m.role === "user"
                        ? "bg-brand text-white"
                        : "border border-border bg-elevated/50 text-ink"
                    )}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                    {m.role === "assistant" && m.mode === "demo" ? (
                      <p className="mt-1 text-[0.7rem] text-warning">Demo-Modus (KI nicht verbunden)</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border bg-elevated/50 px-3.5 py-2 text-sm text-faint">
                  denkt nach …
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputRef.current) ask(inputRef.current.value);
            }}
            className="mt-3 flex items-center gap-2 border-t border-border pt-3"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Frag dein CRM …"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
            />
            <Button type="submit" disabled={pending} className="flex-none">
              <IconSpark size={16} /> Fragen
            </Button>
          </form>
        </div>
      </Dialog>
    </>
  );
}
