"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ingestCv } from "@/lib/cv-actions";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

/**
 * „CV hochladen" – lädt eine oder mehrere CV-Dateien in den privaten
 * Storage-Bucket (ANON-Key + Session) und legt je Datei automatisch
 * eine:n Kandidat:in an (Name/Position/E-Mail/Telefon werden erkannt).
 */
const BUCKET = "candidate-cvs";
const ACCEPT = ".pdf,.doc,.docx";

type Status = "warten" | "lädt hoch" | "analysiert" | "fertig" | "fehler";
type Item = { file: File; status: Status; name?: string; error?: string };

function safeName(n: string): string {
  const s = n
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-");
  return s.slice(-60) || "cv";
}

const statusClass: Record<Status, string> = {
  warten: "text-faint",
  "lädt hoch": "text-muted",
  analysiert: "text-muted",
  fertig: "text-success",
  fehler: "text-danger",
};

export function CvUploadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setItems([]);
    setDone(0);
    setBusy(false);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list: Item[] = Array.from(files).map((f) => ({ file: f, status: "warten" }));
    setItems(list);
    setBusy(true);
    setDone(0);
    const supabase = createClient();
    let ok = 0;

    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      try {
        setItems((p) => p.map((x, idx) => (idx === i ? { ...x, status: "lädt hoch" } : x)));
        const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(it.file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, it.file, { upsert: true, contentType: it.file.type || undefined });
        if (upErr) throw new Error(upErr.message);

        setItems((p) => p.map((x, idx) => (idx === i ? { ...x, status: "analysiert" } : x)));
        const res = await ingestCv({ cv_path: path, cv_filename: it.file.name });
        if (!res.ok) throw new Error(res.error ?? "Anlegen fehlgeschlagen.");
        ok++;
        setItems((p) =>
          p.map((x, idx) => (idx === i ? { ...x, status: "fertig", name: res.candidate?.name } : x))
        );
      } catch (e) {
        setItems((p) =>
          p.map((x, idx) =>
            idx === i ? { ...x, status: "fehler", error: e instanceof Error ? e.message : "Fehler" } : x
          )
        );
      }
      setDone(i + 1);
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) router.refresh();
  }

  const anyDone = items.some((x) => x.status === "fertig");

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <IconPlus size={16} /> CV hochladen
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="CV(s) hochladen"
        description="PDF oder Word – Name, Position, E-Mail und Telefon werden automatisch erkannt und als Kandidat:in angelegt."
      >
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-elevated/40 px-4 py-8 text-center transition-colors hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-sm font-semibold text-ink">Dateien auswählen</span>
            <span className="text-xs text-muted">PDF, DOC oder DOCX · auch mehrere gleichzeitig</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {items.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  {done}/{items.length} verarbeitet
                </span>
                {busy ? <span>bitte warten …</span> : null}
              </div>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-ink">{it.name || it.file.name}</span>
                    <span className={statusClass[it.status]}>
                      {it.status === "fertig"
                        ? "✓ angelegt"
                        : it.status === "fehler"
                        ? it.error || "Fehler"
                        : `${it.status} …`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!busy) setOpen(false);
              }}
              disabled={busy}
            >
              {anyDone ? "Schließen" : "Abbrechen"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
