"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconFolder } from "@/components/ui/icons";
import { cvSignedUrl } from "@/lib/cv-actions";

/** Öffnet den CV über einen kurzlebigen, signierten Download-Link. */
export function CvDownloadButton({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const res = await cvSignedUrl(path);
      if (res.ok && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else setError(res.error ?? "Link konnte nicht erzeugt werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button variant="subtle" onClick={open} disabled={loading}>
        <IconFolder size={16} /> {loading ? "öffne …" : "CV öffnen"}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
