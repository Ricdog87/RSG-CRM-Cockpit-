"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";

const CV_BUCKET = "candidate-cvs";
const PHOTO_BUCKET = "candidate-photos";

async function currentPartnerId(): Promise<{ id: string | null; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Keine aktive Session." };
  const { data, error } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) return { id: null, error: "Kein Partner-Profil gefunden." };
  return { id: data.id as string };
}

/** Setzt photo_path eines bestehenden Kandidaten (nach Upload in den Bucket). */
export async function attachCandidatePhoto(
  candidateId: string,
  photoPath: string
): Promise<ActionResult> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: updErr } = await supabase
    .from("candidates")
    .update({ photo_path: photoPath })
    .eq("id", candidateId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

/** Kurzlebiger signierter Link für ein Kandidatenfoto. */
export async function candidatePhotoSignedUrl(
  path: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (useMockData) return { ok: false, error: "Demo-Modus." };
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data) return { ok: false, error: error?.message ?? "Link fehlgeschlagen." };
  return { ok: true, url: data.signedUrl };
}

/** Extrahiert das eingebettete Bewerbungsfoto aus dem PDF-CV (mupdf, volle Auflösung). */
function extractPortrait(pdf: Uint8Array, mupdf: typeof import("mupdf")): Uint8Array | null {
  try {
    const doc = mupdf.Document.openDocument(pdf, "application/pdf");
    const cands: { png: Uint8Array; w: number; h: number; y: number }[] = [];
    for (let p = 0; p < Math.min(2, doc.countPages()); p++) {
      const page = doc.loadPage(p);
      const st = page.toStructuredText("preserve-images");
      st.walk({
        onImageBlock(bbox: { y: number }, _ctm: unknown, image: { toPixmap(): { asPNG(): Uint8Array; getWidth(): number; getHeight(): number } }) {
          const pix = image.toPixmap();
          cands.push({ png: pix.asPNG(), w: pix.getWidth(), h: pix.getHeight(), y: bbox.y });
        },
      } as unknown as Parameters<typeof st.walk>[0]);
    }
    const best = cands
      .filter((c) => c.w >= 80 && c.h >= 80 && c.h / c.w >= 0.8 && c.h / c.w <= 1.8)
      .sort((a, b) => a.y - b.y)[0];
    return best ? best.png : null;
  } catch {
    return null;
  }
}

/**
 * Lädt das CV der:des Kandidat:in, extrahiert das Bewerbungsfoto und legt es
 * im Bucket candidate-photos ab; setzt photo_path. Nur PDF.
 */
export async function extractCandidatePhotoFromCv(
  candidateId: string
): Promise<ActionResult & { photo_path?: string }> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { data: cand } = await supabase
    .from("candidates")
    .select("cv_path, cv_filename, photo_path")
    .eq("id", candidateId)
    .maybeSingle();
  const c = (cand as { cv_path?: string; cv_filename?: string; photo_path?: string } | null) ?? null;
  if (!c?.cv_path) return { ok: false, error: "Kein CV hinterlegt." };
  if (c.photo_path) return { ok: true, photo_path: c.photo_path };
  if (!/\.pdf$/i.test(c.cv_filename ?? "")) return { ok: false, error: "Foto-Extraktion nur aus PDF-CV." };

  const { data: file, error: dlErr } = await supabase.storage.from(CV_BUCKET).download(c.cv_path);
  if (dlErr || !file) return { ok: false, error: dlErr?.message ?? "CV nicht gefunden." };

  const mupdf = await import("mupdf");
  const png = extractPortrait(new Uint8Array(await file.arrayBuffer()), mupdf);
  if (!png) return { ok: false, error: "Kein Foto im CV gefunden." };

  const path = `${candidateId}/portrait-${Date.now()}.png`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, png, { upsert: true, contentType: "image/png" });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: updErr } = await supabase
    .from("candidates")
    .update({ photo_path: path })
    .eq("id", candidateId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true, photo_path: path };
}
