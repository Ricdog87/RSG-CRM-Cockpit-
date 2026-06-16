"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconPencil } from "@/components/ui/icons";
import {
  attachCandidatePhoto,
  candidatePhotoSignedUrl,
  extractCandidatePhotoFromCv,
} from "@/lib/cv-photo";

const BUCKET = "candidate-photos";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/**
 * Profilfoto: zeigt das Foto (signierte URL) oder Initialen, mit Button zum
 * Hochladen/Ändern. Ist kein Foto, aber ein CV vorhanden, wird beim Öffnen
 * einmalig versucht, das Bewerbungsfoto aus dem CV zu extrahieren.
 */
export function CandidatePhoto({
  candidateId,
  name,
  photoPath,
  hasCv,
  size = 56,
}: {
  candidateId: string;
  name: string;
  photoPath?: string;
  hasCv: boolean;
  size?: number;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triedAuto = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (photoPath) {
        const r = await candidatePhotoSignedUrl(photoPath);
        if (active && r.ok && r.url) setUrl(r.url);
      } else if (hasCv && !triedAuto.current) {
        triedAuto.current = true;
        const r = await extractCandidatePhotoFromCv(candidateId);
        if (active && r.ok && r.photo_path && !r.demo) router.refresh();
      }
    })();
    return () => {
      active = false;
    };
  }, [photoPath, hasCv, candidateId, router]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${candidateId}/photo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (!error) {
        const r = await attachCandidatePhoto(candidateId, path);
        if (r.ok && !r.demo) router.refresh();
        const su = await candidatePhotoSignedUrl(path);
        if (su.ok && su.url) setUrl(su.url);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative flex-none" style={{ height: size, width: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full rounded-2xl object-cover ring-1 ring-border"
          style={{ height: size, width: size }}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-sky font-black text-white"
          style={{ height: size, width: size, fontSize: size * 0.34 }}
        >
          {initials(name) || "?"}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Foto hochladen/ändern"
        aria-label="Foto hochladen/ändern"
        className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-faint shadow-sm transition-colors hover:text-brand-deep disabled:opacity-60"
      >
        <IconPencil size={12} />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
