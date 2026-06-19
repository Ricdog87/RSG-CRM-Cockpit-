import "server-only";
import { llmComplete, extractJson } from "@/lib/ai/llm";

/**
 * Öffentliches Firmenprofil aus der Unternehmens-Website.
 * Anthropic (Claude) liest den Klartext der Startseite und extrahiert ein
 * striktes JSON. Es werden NUR Angaben übernommen, die die Seite hergibt –
 * niemals erfundene Daten.
 */
export interface CompanyEnrichment {
  branche?: string;
  segment?: string;
  ort?: string;
  country?: string;
  beschreibung?: string;
  mitarbeiter_ca?: string;
  gegruendet?: string;
}

/** Normalisiert eine Domain zu einer ladbaren Homepage-URL.
 *  - stellt https voran (falls Schema fehlt)
 *  - entfernt Pfad/Query/Fragment (nur Origin) */
function normalizeHomepageUrl(domain: string): string {
  let raw = (domain ?? "").trim();
  if (!raw) throw new Error("Keine Domain angegeben.");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Ungültige Domain: ${domain}`);
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    throw new Error(`Ungültige Domain: ${domain}`);
  }
  return `${url.protocol}//${url.hostname}`;
}

/** Strippt HTML grob zu lesbarem Text (Tags/Scripts/Styles weg) und kürzt. */
function htmlToText(html: string, maxChars = 6000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
}

const SYSTEM = [
  "Du bist ein präziser B2B-Datenextraktor. Du erhältst den Klartext der",
  "Startseite einer Unternehmens-Website. Extrahiere ausschließlich Fakten,",
  "die der Text tatsächlich hergibt – erfinde NICHTS. Wenn eine Angabe fehlt,",
  "lass das Feld weg oder setze es auf null. Antworte NUR mit einem JSON-Objekt",
  "mit den Feldern: branche (Branche/Industrie), segment (Teilsegment/Fokus),",
  "ort (Stadt des Hauptsitzes), country (Land), beschreibung (1–2 Sätze, was die",
  "Firma macht), mitarbeiter_ca (ungefähre Mitarbeiterzahl als Text),",
  "gegruendet (Gründungsjahr als Text). Sprache: Deutsch.",
].join(" ");

/**
 * Lädt die Homepage der Domain serverseitig (mit Timeout), strippt den Text und
 * extrahiert via Claude ein striktes Firmenprofil. Wirft bei Fetch-/Parse-Fehlern
 * eine sprechende Fehlermeldung.
 */
export async function enrichCompanyFromWebsite(domain: string): Promise<CompanyEnrichment> {
  const url = normalizeHomepageUrl(domain);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let html: string;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSG-Cockpit/1.0; +https://recruiting-sg.de)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`Website nicht erreichbar (HTTP ${res.status}).`);
    }
    html = await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Zeitüberschreitung beim Laden der Website (>8s).");
    }
    if (e instanceof Error && /HTTP \d+/.test(e.message)) throw e;
    throw new Error(
      `Website konnte nicht geladen werden: ${e instanceof Error ? e.message : "Unbekannter Fehler"}`
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = htmlToText(html);
  if (!text) {
    throw new Error("Website lieferte keinen lesbaren Text.");
  }

  const user = `Website: ${url}\n\nKlartext der Startseite:\n${text}`;
  let raw: string;
  try {
    raw = await llmComplete(SYSTEM, user);
  } catch (e) {
    throw new Error(
      `KI-Analyse fehlgeschlagen: ${e instanceof Error ? e.message : "Unbekannter Fehler"}`
    );
  }

  const data = extractJson<Record<string, unknown>>(raw);
  const pick = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s && s.toLowerCase() !== "null" ? s : undefined;
  };
  return {
    branche: pick(data.branche),
    segment: pick(data.segment),
    ort: pick(data.ort),
    country: pick(data.country),
    beschreibung: pick(data.beschreibung),
    mitarbeiter_ca: pick(data.mitarbeiter_ca),
    gegruendet: pick(data.gegruendet),
  };
}
