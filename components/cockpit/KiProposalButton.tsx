"use client";

import { IconCopy } from "@/components/ui/icons";
import type { KiProject } from "@/lib/crm-types";

function eur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}
function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/**
 * Druckfertiges Angebot für ein KI-/Telefonassistenz-Projekt (Setup + MRR,
 * Laufzeit, Gesamtwert). Öffnet ein sauberes Druck-/PDF-Fenster.
 */
export function KiProposalButton({
  project,
  customer,
  contactName,
}: {
  project: KiProject;
  customer: string;
  contactName?: string;
}) {
  function open() {
    const setup = project.setup_fee ?? 0;
    const term = project.term_months ?? 12;
    const totalTerm = setup + project.mrr * term;
    const today = new Date().toLocaleDateString("de-DE");
    const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString("de-DE");

    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"/>
<title>Angebot – ${esc(customer)}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1f2e;max-width:760px;margin:40px auto;padding:0 28px;line-height:1.5}
  .brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0ea5e9;padding-bottom:16px;margin-bottom:24px}
  .logo{font-weight:900;font-size:22px;letter-spacing:-.02em} .logo span{color:#0ea5e9}
  h1{font-size:20px;margin:24px 0 4px} .muted{color:#6b7280;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:14px 0} td,th{padding:9px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:left}
  .total{font-weight:800;font-size:16px} .box{background:#f0f9ff;border:1px solid #cfeafe;border-radius:12px;padding:16px;margin:18px 0}
  .terms{font-size:12px;color:#6b7280;margin-top:28px} .btn{margin:24px 0;display:flex;gap:10px}
  button{background:#0ea5e9;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer}
  button.sec{background:#eef1f6;color:#1a1f2e} @media print{.btn{display:none}}
</style></head><body>
  <div class="brand"><div class="logo">RSG <span>AI</span></div><div class="muted">Angebot · ${today}</div></div>
  <p class="muted">Für: <strong>${esc(customer)}</strong>${contactName ? ` · z.Hd. ${esc(contactName)}` : ""}</p>
  <h1>Angebot KI-Telefonassistenz</h1>
  <p class="muted">Lösung: <strong>${esc(project.product || "KI-Telefonassistenz")}</strong>${project.use_case ? ` · ${esc(project.use_case)}` : ""}</p>

  <div class="box"><strong>Leistungsumfang</strong><br/>
    KI-gestützte Anrufannahme rund um die Uhr, Qualifizierung & Terminbuchung, Anbindung und laufende Optimierung.
  </div>

  <table>
    <thead><tr><th>Leistung</th><th style="text-align:right">Betrag</th></tr></thead>
    <tbody>
      <tr><td>Einrichtung & Implementierung (einmalig)</td><td style="text-align:right">${eur(setup)}</td></tr>
      <tr><td>Monatlicher Fixpreis (Betrieb, Wartung, Updates)</td><td style="text-align:right">${eur(project.mrr)}/Monat</td></tr>
      <tr class="total"><td>Gesamtwert über ${term} Monate</td><td style="text-align:right">${eur(totalTerm)}</td></tr>
    </tbody>
  </table>

  <p class="terms">
    Laufzeit ${term} Monate${project.billing_cycle ? `, Abrechnung ${esc(project.billing_cycle)}` : ""}.
    Es gelten unsere AGB. Angebot freibleibend, gültig bis ${validUntil}.
  </p>

  <div class="btn">
    <button onclick="window.print()">Drucken / als PDF speichern</button>
    <button class="sec" onclick="window.close()">Schließen</button>
  </div>
</body></html>`;

    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-1.5 rounded-lg border border-sky/40 bg-sky/10 px-3 py-1.5 text-sm font-semibold text-sky-deep transition-colors hover:bg-sky/15"
    >
      <IconCopy size={14} /> Angebot erstellen
    </button>
  );
}
