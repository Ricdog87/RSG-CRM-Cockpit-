"use client";

import { IconCopy } from "@/components/ui/icons";
import {
  mandateRevenue,
  mandateFeePerPosition,
  mandatePaymentSchedule,
  type RecruitingMandate,
} from "@/lib/crm-types";

function eur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/**
 * Erzeugt ein druckfertiges Vermittlungs-Angebot (öffnet ein sauberes Fenster
 * → Drucken / als PDF speichern). Nutzt die vorhandene Honorar-/Zahlungslogik.
 */
export function MandateProposalButton({
  mandate,
  customer,
  contactName,
  senderName,
}: {
  mandate: RecruitingMandate;
  customer: string;
  contactName?: string;
  senderName?: string;
}) {
  function open() {
    const total = mandateRevenue(mandate);
    const perPos = mandateFeePerPosition(mandate);
    const schedule = mandatePaymentSchedule(mandate);
    const today = new Date().toLocaleDateString("de-DE");
    const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString("de-DE");
    const pricingLine =
      mandate.pricing_model === "percent"
        ? `${mandate.fee_percent ?? 0}% vom Bruttojahreszielgehalt (${eur(mandate.target_salary ?? 0)}) = ${eur(perPos)} je Position`
        : `Festpreis ${eur(perPos)} je besetzter Position`;

    const rows = schedule
      .map((p) => `<tr><td>${esc(p.label)}</td><td style="text-align:right">${eur(p.amount)}</td></tr>`)
      .join("");

    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"/>
<title>Angebot – ${esc(customer)}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1f2e;max-width:760px;margin:40px auto;padding:0 28px;line-height:1.5}
  .brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #2b59ff;padding-bottom:16px;margin-bottom:24px}
  .logo{font-weight:900;font-size:22px;letter-spacing:-.02em} .logo span{color:#2b59ff}
  h1{font-size:20px;margin:24px 0 4px} .muted{color:#6b7280;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:14px 0} td,th{padding:9px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:left}
  .total{font-weight:800;font-size:16px} .box{background:#f6f8ff;border:1px solid #dbe3ff;border-radius:12px;padding:16px;margin:18px 0}
  .terms{font-size:12px;color:#6b7280;margin-top:28px} .btn{margin:24px 0;display:flex;gap:10px}
  button{background:#2b59ff;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer}
  button.sec{background:#eef1f6;color:#1a1f2e}
  @media print{.btn{display:none}}
</style></head><body>
  <div class="brand"><div class="logo">RSG <span>Recruiting</span></div><div class="muted">Angebot · ${today}</div></div>
  <p class="muted">Für: <strong>${esc(customer)}</strong>${contactName ? ` · z.Hd. ${esc(contactName)}` : ""}</p>
  <h1>Angebot Personalvermittlung</h1>
  <p class="muted">Position: <strong>${esc(mandate.role || "—")}</strong> · ${mandate.positions} Stelle(n)</p>

  <div class="box">
    <strong>Konditionen</strong><br/>${esc(pricingLine)}
    ${mandate.split_payment ? "<br/>Erfolgshonorar 50/50: 50 % bei Vertragsunterzeichnung, 50 % nach 3 Monaten Betriebszugehörigkeit." : ""}
  </div>

  <table>
    <thead><tr><th>Leistung</th><th style="text-align:right">Betrag</th></tr></thead>
    <tbody>
      <tr><td>Personalvermittlung „${esc(mandate.role || "Position")}“ (${mandate.positions} Stelle(n))</td><td style="text-align:right">${eur(total)}</td></tr>
      <tr class="total"><td>Gesamthonorar</td><td style="text-align:right">${eur(total)}</td></tr>
    </tbody>
  </table>

  ${rows ? `<strong>Zahlungsplan</strong><table><tbody>${rows}</tbody></table>` : ""}

  <p class="terms">
    Erfolgsbasiert: Das Honorar wird ausschließlich bei erfolgreicher Vermittlung fällig (sofern keine Anzahlung vereinbart).
    Es gelten unsere Vermittlungs-AGB. Angebot freibleibend, gültig bis ${validUntil}.
    ${senderName ? `<br/>Ihr Ansprechpartner: ${esc(senderName)}, RSG Recruiting.` : ""}
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand/15"
    >
      <IconCopy size={14} /> Angebot erstellen
    </button>
  );
}
