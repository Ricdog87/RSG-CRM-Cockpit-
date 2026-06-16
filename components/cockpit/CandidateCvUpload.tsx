"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { attachCv } from "@/lib/cv-actions";
import { Button } from "@/components/ui/Button";
import { IconFolder } from "@/components/ui/icons";

const BUCKET = "candidate-cvs";
const ACCEPT = ".pdf,.doc,.docx";

function safeName(n: string): string {
  const s = n
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-");
  return s.slice(-60) || "cv";
}

/**
 * CV nachträglich an eine:n bestehende:n Kandidat:in hochladen oder ersetzen.
 * Lädt die Datei mit ANON-Key + Session in den privaten Bucket und verknüpft
 * sie über die Server-Action `attachCv` (kein neuer Datensatz).
 */
export function CandidateCvUpload({
  candidateId,
  hasCv,
}: {
  candidateId: string;
  hasCv: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);
      const res = await attachCv({ candidateId, cv_path: path, cv_filename: file.name });
      if (!res.ok) throw new Error(res.error ?? "Verknüpfen fehlgeschlagen.");
      if (!res.demo) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <Button
        variant={hasCv ? "ghost" : "primary"}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        type="button"
      >
        <IconFolder size={15} /> {busy ? "lädt hoch …" : hasCv ? "CV ersetzen" : "CV hochladen"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFile}
      />
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
