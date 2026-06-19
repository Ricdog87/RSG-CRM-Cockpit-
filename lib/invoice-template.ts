/**
 * Druckfertige RSG-Recruiting-Honorarrechnung (HTML → Drucken / als PDF).
 * Einheitliches Branding über lib/brand-document. Reine Funktion.
 * Hinweis: kaufmännisch sauber gebrandet; finale Buchung erfolgt in Lexware.
 */
import {
  rsgBrandHeaderHtml,
  rsgLegalFooterHtml,
  BRAND_HEADER_CSS,
  RSG_COMPANY,
} from "@/lib/brand-document";

export interface InvoiceDocParams {
  invoiceNo?: string;
  issueDate?: string; // ISO
  dueDate?: string; // ISO
  customerName: string;
  customerStreet?: string;
  customerZip?: string;
  customerCity?: string;
  contactName?: string;
  role?: string;
  label?: string;
  /** Nettobetrag (€) */
  amount: number;
  /** USt-Satz in Prozent (Standard 19). 0 = keine USt ausweisen. */
  vatRate?: number;
}

function eur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v || 0);
}
function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
function deDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE");
}

export function buildInvoiceHtml(p: InvoiceDocParams): string {
  const issue = deDate(p.issueDate) || new Date().toLocaleDateString("de-DE");
  const due = deDate(p.dueDate);
  const vatRate = p.vatRate ?? 19;
  const net = p.amount || 0;
  const vat = vatRate > 0 ? Math.round(net * (vatRate / 100) * 100) / 100 : 0;
  const gross = net + vat;
  const no = p.invoiceNo || `RE-${new Date().getFullYear()}-XXXX`;

  const custAddr = [
    p.customerStreet,
    [p.customerZip, p.customerCity].filter(Boolean).join(" "),
  ]
    .filter((l): l is string => Boolean(l))
    .map((l) => esc(l))
    .join("<br/>");

  const vatRows =
    vatRate > 0
      ? `<tr><td>Nettobetrag</td><td style="text-align:right">${eur(net)}</td></tr>
         <tr><td>zzgl. ${vatRate} % USt.</td><td style="text-align:right">${eur(vat)}</td></tr>
         <tr class="total"><td>Gesamtbetrag</td><td style="text-align:right">${eur(gross)}</td></tr>`
      : `<tr class="total"><td>Gesamtbetrag</td><td style="text-align:right">${eur(net)}</td></tr>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"/>
<title>Rechnung ${esc(no)} – ${esc(p.customerName)}</title>
<style>
  @page{margin:16mm}
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#15192a;max-width:760px;margin:36px auto;padding:0 28px;line-height:1.55;font-size:13.5px}
  ${BRAND_HEADER_CSS}
  h1{font-size:20px;margin:18px 0 4px}
  .addr{display:flex;justify-content:space-between;gap:24px;margin:16px 0 10px}
  .addr .from{font-size:11.5px;color:#6b7280} .meta{margin:8px 0 18px;font-size:12.5px}
  .meta b{display:inline-block;min-width:130px;color:#6b7280;font-weight:600}
  table{width:100%;border-collapse:collapse;margin:14px 0} td,th{padding:9px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:left}
  .total{font-weight:800;font-size:16px}
  .terms{font-size:12px;color:#6b7280;margin-top:24px}
  .btn{margin:22px 0;display:flex;gap:10px} button{background:#111;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer}
  button.sec{background:#eef1f6;color:#15192a}
  @media print{.btn{display:none} body{margin:0;max-width:none}}
</style></head><body>
  ${rsgBrandHeaderHtml(`Honorarrechnung · ${issue}`)}

  <div class="addr">
    <div class="to">
      <div class="muted">Rechnungsempfänger</div>
      <strong>${esc(p.customerName)}</strong><br/>
      ${p.contactName ? `z.Hd. ${esc(p.contactName)}<br/>` : ""}
      ${custAddr || '<span class="muted">— Adresse —</span>'}
    </div>
    <div class="from">
      ${esc(RSG_COMPANY.name)}<br/>${esc(RSG_COMPANY.street)}<br/>${esc(RSG_COMPANY.city)}<br/>${esc(RSG_COMPANY.hrb)}
    </div>
  </div>

  <h1>Honorarrechnung</h1>
  <div class="meta">
    <div><b>Rechnungsnummer</b> ${esc(no)}</div>
    <div><b>Rechnungsdatum</b> ${issue}</div>
    ${due ? `<div><b>Zahlbar bis</b> ${due}</div>` : ""}
    <div><b>Leistung</b> Personalvermittlung${p.role ? ` „${esc(p.role)}“` : ""}</div>
  </div>

  <table>
    <thead><tr><th>Position</th><th style="text-align:right">Betrag</th></tr></thead>
    <tbody>
      <tr><td>${esc(p.label || "Vermittlungshonorar")}${p.role ? ` – ${esc(p.role)}` : ""}</td><td style="text-align:right">${eur(net)}</td></tr>
      ${vatRows}
    </tbody>
  </table>

  <p class="terms">
    Bitte überweisen Sie den Gesamtbetrag${due ? ` bis zum ${due}` : " innerhalb von 14 Tagen"} unter Angabe der
    Rechnungsnummer auf folgendes Konto:<br/>
    IBAN: ${RSG_COMPANY.iban} · BIC: ${RSG_COMPANY.bic}.<br/>
    Es gelten unsere Vermittlungs-AGB.
  </p>

  ${rsgLegalFooterHtml()}

  <div class="btn">
    <button onclick="window.print()">Drucken / als PDF speichern</button>
    <button class="sec" onclick="window.close()">Schließen</button>
  </div>
</body></html>`;
}
