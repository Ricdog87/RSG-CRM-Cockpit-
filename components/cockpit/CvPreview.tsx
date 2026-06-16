"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cvSignedUrl } from "@/lib/cv-actions";

/** Blendet eine PDF-CV-Vorschau direkt im Profil ein (signierter Link). */
export function CvPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (url) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await cvSignedUrl(path);
    setLoading(false);
    if (res.ok && res.url) {
      setUrl(res.url);
      setOpen(true);
    } else {
      setError(res.error ?? "Vorschau nicht verfügbar.");
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="ghost" onClick={toggle} disabled={loading} type="button">
        {loading ? "lädt …" : open ? "Vorschau ausblenden" : "Vorschau anzeigen"}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {open && url ? (
        <iframe
          src={url}
          title="CV-Vorschau"
          className="h-[600px] w-full rounded-xl border border-border"
        />
      ) : null}
    </div>
  );
}
