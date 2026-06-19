/**
 * Gemeinsame Marken-Bausteine für alle druckbaren RSG-Recruiting-Dokumente
 * (Angebot, Rechnung, Personalvermittlungsvertrag). Sorgt für ein einheitliches
 * Erscheinungsbild: RSG-Logo im Header, gleiche Typo, gleicher Rechts-Footer.
 * Reine, clientseitig nutzbare Funktionen – nur RSG Recruiting.
 */

/** Firmen-/Rechtsangaben RSG Recruiting (Absender & Footer). */
export const RSG_COMPANY = {
  name: "RSG Recruiting Solutions Group GmbH",
  rep: "Geschäftsführer: Ricardo Serrano",
  street: "Am Heiligenhaus 9",
  city: "65207 Wiesbaden",
  hrb: "HRB 35951 Amtsgericht Wiesbaden",
  iban: "DE43 5107 0021 0980 9567 00",
  bic: "DEUTDEFF510",
};

/** Einzeiliger Rechts-/Bank-Footer für alle Dokumente. */
export const RSG_LEGAL_FOOTER = `${RSG_COMPANY.name} · ${RSG_COMPANY.hrb} · ${RSG_COMPANY.rep} · IBAN: ${RSG_COMPANY.iban} · BIC: ${RSG_COMPANY.bic}`;

/** Absolute URL zum RSG-Logo (für `window.open`-Dokumente). */
export function rsgLogoUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/contract/rsg-logo.png`;
}

/** Gemeinsames CSS für Header, Logo & Footer der RSG-Dokumente. */
export const BRAND_HEADER_CSS = `
  .brand{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:22px}
  .logo-img{height:46px;width:auto;display:block}
  .logo{font-weight:900;font-size:22px;letter-spacing:-.02em} .logo span{color:#2b59ff}
  .muted{color:#6b7280;font-size:12px}
  .legal{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;font-size:10.5px;color:#8a90a2;line-height:1.5}
`;

/**
 * Header-Block mit RSG-Logo (Bild) und rechtsbündigem Kontext (z.B.
 * "Angebot · 19.6.2026"). Fällt ohne Logo auf den gestylten Schriftzug zurück.
 */
export function rsgBrandHeaderHtml(rightText: string, logoUrl?: string): string {
  const url = logoUrl ?? rsgLogoUrl();
  const logo = url
    ? `<img src="${url}" class="logo-img" alt="RSG Recruiting"/>`
    : `<div class="logo">RSG <span>Recruiting</span></div>`;
  return `<div class="brand">${logo}<div class="muted">${rightText}</div></div>`;
}

/** Rechts-/Bank-Footer als HTML-Block. */
export function rsgLegalFooterHtml(): string {
  return `<div class="legal">${RSG_LEGAL_FOOTER}</div>`;
}
