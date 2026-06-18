/**
 * Generator für den Personalvermittlungsvertrag (RSG) – als druckfertiges
 * HTML-Dokument (Drucken / als PDF speichern). Zwei Standardmodelle:
 *  - "fixed"   : Festpreis je Vermittlung (mit Anzahlung + Restbetrag)
 *  - "percent" : % vom Jahresbruttozielgehalt, optional mit 50/50-Splittung
 * Reine Funktion (clientseitig nutzbar). Kontaktdaten kommen aus der Kundenmaske.
 */
export type ContractType = "fixed" | "percent";

export interface ContractParams {
  type: ContractType;
  customerName: string;
  customerStreet?: string;
  customerZip?: string;
  customerCity?: string;
  contactName?: string;
  role?: string;
  /** Festpreis: Gesamthonorar netto (€) */
  fee?: number;
  /** Festpreis: Anzahlung netto (€) */
  deposit?: number;
  /** Prozent-Modell: Honorarsatz (%) */
  percent?: number;
  /** Prozent-Modell: 50/50-Splittung (Unterzeichnung / nach 3 Monaten) */
  split?: boolean;
  place?: string;
  date?: string;
  /** Absolute URLs zu Logo & Unterschrift (aus /public/contract). */
  logoUrl?: string;
  signatureUrl?: string;
}

const RSG = {
  name: "RSG Recruiting- Solutions Group GmbH",
  rep: "vertreten durch Herrn Ricardo Serrano",
  street: "Am Heiligenhaus 9",
  city: "65207 Wiesbaden",
};

function eur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}
function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function beauftragungFixed(p: ContractParams): string {
  const fee = p.fee ?? 9999;
  const deposit = p.deposit ?? 2500;
  const rest = Math.max(0, fee - deposit);
  const role = esc(p.role || "einer zu besetzenden Position (m/w/d)");
  return `<p><strong>§ 1 Beauftragung.</strong> Der Auftraggeber beauftragt RSG mit der Rekrutierung ${/^eines|^einer/.test(role) ? "" : "eines/einer "}${role}.
  Das Honorar für eine erfolgreiche Vermittlung beträgt <strong>${eur(fee)} netto</strong>. Eine Anzahlung in Höhe von <strong>${eur(deposit)} netto</strong> ist bei Beauftragung fällig.
  Der Restbetrag in Höhe von <strong>${eur(rest)}</strong> wird mit Unterzeichnung des Arbeitsvertrags zwischen dem Auftraggeber und dem vermittelten Kandidaten fällig.
  Die Personalvermittlung erfolgt ausschließlich im Auftrag des Unternehmens. Für die vermittelten Personen entstehen keine Kosten.</p>`;
}

function beauftragungPercent(p: ContractParams): string {
  const pct = p.percent ?? 25;
  const role = p.role ? `eines/einer ${esc(p.role)}` : "von Personal für unterschiedliche Positionen";
  const payment = p.split
    ? `<p>Die Rechnungsstellung erfolgt in zwei Teilbeträgen:</p>
       <ol><li><strong>1. Teilrechnung:</strong> 50 % des Honorars – fällig mit Unterzeichnung des Arbeitsvertrages zwischen dem Auftraggeber und dem von RSG vermittelten Kandidaten.</li>
       <li><strong>2. Teilrechnung:</strong> 50 % des Honorars – fällig nach 3 Monaten Betriebszugehörigkeit des vermittelten Kandidaten.</li></ol>`
    : `<p>Das Vermittlungshonorar ist mit Unterzeichnung des Arbeitsvertrages zwischen dem Auftraggeber und dem vermittelten Kandidaten in voller Höhe fällig.</p>`;
  return `<p><strong>§ 1 Beauftragung.</strong> Der Auftraggeber beauftragt RSG mit der Rekrutierung ${role} mittels individuellem schriftlichen Anforderungsprofil.
  Das Honorar pro Auftrag beträgt <strong>${pct} % des zwischen dem Auftraggeber und dem Bewerber vereinbarten Jahresbruttozielgehalts</strong>.</p>
  ${payment}
  <p>RSG erklärt ausdrücklich, dass die Personalvermittlung für Bewerber grundsätzlich kostenlos ist und keine Gebühren oder Kostenerstattungen von Bewerbern verlangt werden.</p>`;
}

function agbFixed(p: ContractParams): string {
  const fee = p.fee ?? 9999;
  const deposit = p.deposit ?? 2500;
  const rest = Math.max(0, fee - deposit);
  return `
  <h2>Allgemeine Geschäftsbedingungen (AGB) für Personalvermittlung – RSG Recruiting Solutions Group GmbH</h2>
  <p><strong>§ 1 Leistungsgegenstand.</strong> RSG erbringt professionelle Dienstleistungen im Bereich Personalvermittlung. Der Leistungsumfang umfasst: Analyse und Abstimmung des Anforderungsprofils; Veröffentlichung geeigneter Stellenanzeigen; Active Sourcing &amp; Direktansprache; Durchführung strukturierter Interviews; Präsentation geeigneter Kandidat:innen; Interviewkoordination &amp; Prozessbegleitung. RSG schuldet keinen konkreten Einstellungserfolg, sondern die professionelle Durchführung des vereinbarten Such- und Auswahlprozesses nach marktüblichen Recruiting-Standards.</p>
  <p><strong>§ 2 Vertragslaufzeit &amp; Kündigung.</strong> Der Vermittlungsvertrag beginnt mit Unterzeichnung und endet mit erfolgreicher Besetzung oder schriftlicher Kündigung mit 4 Wochen Frist zum Monatsende. Kandidat:innen, die innerhalb von 12 Monaten nach letzter Vorstellung eingestellt werden, gelten als vermittelt. Bereits erbrachte Leistungen sowie die Anzahlung verbleiben vollständig bei RSG und sind nicht erstattungsfähig. Kündigung entbindet nicht von bereits entstandenen Zahlungsansprüchen.</p>
  <p><strong>§ 3 Mitteilungspflichten.</strong> Der Auftraggeber verpflichtet sich, RSG binnen 14 Kalendertagen nach Unterzeichnung des Arbeitsvertrags über eine Einstellung zu informieren.</p>
  <p><strong>§ 4 Vertraulichkeit &amp; Datenschutz.</strong> Alle Informationen und Unterlagen werden vertraulich behandelt. Die Verarbeitung personenbezogener Daten erfolgt gemäß DSGVO &amp; BDSG. Eine Weitergabe von Bewerberdaten an Dritte ist untersagt. Daten sind nach Abschluss des Auswahlprozesses zu löschen.</p>
  <p><strong>§ 5 Vorabkontakte / Doppelbewerbungen.</strong> Ist ein vorgestellter Kandidat dem Auftraggeber bereits bekannt, ist dies innerhalb von 7 Werktagen schriftlich mitzuteilen. Erfolgt keine Mitteilung, gilt der Kandidat als provisionspflichtig vermittelt.</p>
  <p><strong>§ 6 Eigentum &amp; Rückgabe.</strong> Sämtliche Unterlagen bleiben geistiges Eigentum von RSG. Bei Nichtbesetzung sind die Unterlagen auf Wunsch vollständig zurückzugeben oder zu löschen.</p>
  <p><strong>§ 7 Vergütung &amp; Fälligkeit.</strong> Vermittlungshonorar: ${eur(fee)} netto pro Vakanz. Zahlung in zwei Stufen: ${eur(deposit)} netto bei Beauftragung; ${eur(rest)} netto bei Vertragsunterzeichnung des Kandidaten. Fälligkeit entsteht mit Abschluss eines Arbeits-, Dienst- oder Freelancervertrages oder tatsächlicher Tätigkeitsaufnahme – je nachdem, was zuerst eintritt. Alle Beträge sind sofort ohne Abzug fällig. Bei Zahlungsverzug gelten Verzugszinsen i.H.v. 5 % über Basiszins gem. § 288 BGB.</p>
  <p><strong>§ 8 Nachbesetzungsgarantie.</strong> Scheidet ein von RSG vermittelter Kandidat innerhalb der vereinbarten Probezeit von bis zu sechs Monaten aus dem Beschäftigungsverhältnis aus Gründen, die nicht vom Auftraggeber zu vertreten sind, bietet RSG eine einmalige kostenfreie Nachbesetzung für dieselbe Vakanz an. Bedingungen: (1) keine betriebsbedingte Kündigung, Umstrukturierung, Standortschließung o.Ä. des Auftraggebers; (2) vollständige Zahlung des Vermittlungshonorars; (3) im Wesentlichen unverändertes Anforderungsprofil; (4) ausschließlich neuer, durch RSG initiierter Suchprozess. Ein Anspruch auf Rückerstattung des Honorars besteht nicht.</p>
  <p><strong>§ 9 Nachträglicher Vertragsschluss / Sperrfrist.</strong> Kommt es innerhalb von 12 Monaten nach der letzten Vorstellung zu einer Einstellung, gilt der Kandidat als vermittelt. Der volle Honoraranspruch bleibt bestehen – auch bei vorheriger Vertragskündigung.</p>
  <p><strong>§ 10 Vertragsstrafe bei Umgehung.</strong> Erfolgt eine direkte oder indirekte Einstellung, Beauftragung oder sonstige Zusammenarbeit mit einem durch RSG vorgestellten Kandidaten innerhalb von 12 Monaten nach letzter Vorstellung ohne Entrichtung des Honorars, bleibt der Honoraranspruch in voller Höhe bestehen. Dies gilt auch bei verbundenen Unternehmen (§ 15 AktG), Tochter-/Schwesterunternehmen, Kooperationspartnern oder Dritten sowie bei Freelancer-, Dienst-, Werk- oder Beratungsverträgen. Der Auftraggeber zahlt in diesen Fällen 100 % des Honorars; weitergehender Schadensersatz bleibt vorbehalten.</p>
  <p><strong>§ 11 Haftung.</strong> RSG haftet uneingeschränkt bei Vorsatz und grober Fahrlässigkeit, bei einfacher Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten.</p>`;
}

function agbPercent(p: ContractParams): string {
  const pct = p.percent ?? 25;
  const faelligkeit = p.split
    ? `Die Rechnungsstellung erfolgt in zwei Teilbeträgen: 1. Teilrechnung: 50 % – fällig mit Unterzeichnung des Arbeitsvertrages; 2. Teilrechnung: 50 % – fällig nach 3 Monaten Betriebszugehörigkeit.`
    : `Das Vermittlungshonorar ist in voller Höhe mit Unterzeichnung des Arbeitsvertrages fällig.`;
  const nachbesetzung = p.split
    ? `Scheidet ein von RSG vermittelter Kandidat innerhalb der ersten 3 Monate Betriebszugehörigkeit aus Gründen, die nicht vom Auftraggeber zu vertreten sind, aus, entfällt der Anspruch auf die 2. Teilrechnung. Die bereits gezahlte 1. Teilrechnung verbleibt vollständig bei RSG und ist nicht erstattungsfähig.`
    : `Scheidet ein von RSG vermittelter Kandidat innerhalb der ersten 6 Monate aus Gründen, die nicht vom Auftraggeber zu vertreten sind, aus, bietet RSG eine einmalige kostenfreie Nachbesetzung für dieselbe Vakanz an. Ein Anspruch auf Rückerstattung des Honorars besteht nicht.`;
  return `
  <h2>Allgemeine Geschäftsbedingungen (AGB) für Personalvermittlung – RSG Recruiting Solutions Group GmbH</h2>
  <p><strong>§ 1 Vertragsgegenstand.</strong> RSG erbringt Dienstleistungen im Bereich der Personalvermittlung. Gegenstand ist die Identifikation, Ansprache, Auswahl und Vermittlung qualifizierter Kandidaten auf Basis eines abgestimmten Anforderungsprofils. Ein Anspruch auf tatsächliche Besetzung besteht nicht.</p>
  <p><strong>§ 2 Leistungsumfang.</strong> Analyse/Definition des Anforderungsprofils; Identifikation geeigneter Kandidaten (Datenbank, Netzwerk, Active Sourcing); Direktansprache; Durchführung von Interviews und Vorauswahl; Erstellung von Kandidatenprofilen; Koordination von Vorstellungsgesprächen; Unterstützung im gesamten Auswahlprozess. RSG ist berechtigt, moderne Technologien, Automatisierungssysteme sowie KI-gestützte Prozesse einzusetzen.</p>
  <p><strong>§ 3 Honorar / Provision.</strong> Die Personalvermittlung erfolgt auf Erfolgsbasis. Das Honorar beträgt ${pct} % des zwischen Auftraggeber und Kandidat vereinbarten Jahresbruttozielgehalts (Fixgehalt, variable Bestandteile wie Bonus/Provisionen, geldwerte Vorteile). Alle Preise verstehen sich netto zzgl. gesetzlicher MwSt.</p>
  <p><strong>§ 4 Fälligkeit des Honorars.</strong> Der Honoraranspruch entsteht, sobald ein Arbeitsvertrag abgeschlossen wird oder der Kandidat seine Tätigkeit aufnimmt – maßgeblich ist der frühere Zeitpunkt. ${faelligkeit} Jede Rechnung ist innerhalb von 7 Kalendertagen ohne Abzug fällig. Bei Verzug gelten Verzugszinsen i.H.v. 5 % über Basiszins gem. § 288 BGB.</p>
  <p><strong>§ 5 Erweiterter Provisionsanspruch.</strong> Der Anspruch besteht auch, wenn der Kandidat auf eine andere Position, über ein verbundenes Unternehmen, über Dritte/andere Dienstleister oder innerhalb von 12 Monaten nach Erstvorstellung eingestellt wird.</p>
  <p><strong>§ 6 Kandidatenschutz / Umgehungsschutz.</strong> Alle vorgestellten Kandidaten gelten als wirtschaftlich nachgewiesen. Bei direkter oder indirekter Einstellung ist das Honorar fällig – auch bei Weitergabe an Dritte, Nutzung über andere Personaldienstleister oder konzerninterner Weitergabe.</p>
  <p><strong>§ 7 Mitteilungspflichten.</strong> Der Auftraggeber informiert RSG unverzüglich, spätestens innerhalb von 7 Kalendertagen, schriftlich über: Abschluss eines Arbeitsvertrages; Beginn des Arbeitsverhältnisses; Höhe des Jahresbruttozielgehalts; Beendigung innerhalb der ersten 3 Monate (relevant für die 2. Teilrechnung).</p>
  <p><strong>§ 8 Vorabbewerbungen.</strong> Ist ein vorgestellter Kandidat bereits bekannt, ist dies innerhalb von 5 Werktagen schriftlich mitzuteilen; andernfalls gilt der Kandidat als durch RSG vermittelt.</p>
  <p><strong>§ 9 Kündigung.</strong> Der Vermittlungsauftrag kann jederzeit gekündigt werden. Die Kündigung entbindet nicht von der Zahlungspflicht für bereits vorgestellte Kandidaten. Kandidaten, die innerhalb von 12 Monaten nach letzter Vorstellung eingestellt werden, gelten als vermittelt.</p>
  <p><strong>§ 10 Nachbesetzungsgarantie.</strong> ${nachbesetzung}</p>
  <p><strong>§ 11 Vertragsstrafe bei Umgehung.</strong> Erfolgt eine direkte oder indirekte Einstellung/Zusammenarbeit mit einem vorgestellten Kandidaten innerhalb von 12 Monaten nach letzter Vorstellung ohne Entrichtung des Honorars, bleibt der Anspruch in voller Höhe bestehen – auch über verbundene Unternehmen (§ 15 AktG) oder bei Freelancer-/Dienst-/Werk-/Beratungsverträgen. Der Auftraggeber zahlt 100 % des Honorars; weitergehender Schadensersatz bleibt vorbehalten.</p>
  <p><strong>§ 12 Vertraulichkeit &amp; Datenschutz.</strong> Beide Parteien behandeln alle Informationen vertraulich (insb. Kandidatenprofile, Unternehmensdaten, Vergütungsstrukturen). Verarbeitung gemäß DSGVO &amp; BDSG; keine Weitergabe von Bewerberdaten an Dritte.</p>
  <p><strong>§ 13 Eigentum &amp; Rückgabe.</strong> Übergebene Unterlagen bleiben geistiges Eigentum von RSG; bei Nichtbesetzung auf Wunsch zurückzugeben oder zu löschen.</p>
  <p><strong>§ 14 Haftung.</strong> RSG haftet uneingeschränkt bei Vorsatz und grober Fahrlässigkeit, bei einfacher Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten. Keine Haftung für Angaben/Eignung von Kandidaten oder wirtschaftliche Entscheidungen des Auftraggebers.</p>
  <p><strong>§ 15 Schriftform / Salvatorische Klausel.</strong> Änderungen bedürfen der Schriftform. Die Unwirksamkeit einzelner Bestimmungen berührt die übrigen nicht.</p>
  <p><strong>§ 16 Anwendbares Recht und Gerichtsstand.</strong> Es gilt deutsches Recht. Gerichtsstand ist – soweit zulässig – Wiesbaden.</p>`;
}

function signatureBlock(place: string, date: string, signatureUrl?: string): string {
  const rsgSig = signatureUrl ? `<img src="${signatureUrl}" class="sig-img" alt="Unterschrift"/>` : "";
  return `<table class="sig"><tr>
    <td>
      <div class="sigbox"></div>
      <div class="sigline"></div>
      <span class="sigcap">Ort, Datum, Unterschrift (Auftraggeber)</span>
    </td>
    <td>
      <div class="sigbox">${rsgSig}</div>
      <div class="sigline"></div>
      <span class="sigcap">${esc(place)}, ${esc(date)} · Ricardo Serrano (RSG)</span>
    </td>
  </tr></table>`;
}

export function buildPlacementContractHtml(p: ContractParams): string {
  const place = p.place || "Wiesbaden";
  const date = p.date || new Date().toLocaleDateString("de-DE");
  const customerAddr = [p.customerStreet, [p.customerZip, p.customerCity].filter(Boolean).join(" ")]
    .filter(Boolean)
    .map((l) => esc(l!))
    .join("<br/>");
  const beauftragung = p.type === "fixed" ? beauftragungFixed(p) : beauftragungPercent(p);
  const agb = p.type === "fixed" ? agbFixed(p) : agbPercent(p);
  const logo = p.logoUrl
    ? `<img src="${p.logoUrl}" class="logo-img" alt="RSG recruiting."/>`
    : `<div class="logo">RSG <span>recruiting.</span></div>`;
  const legal =
    "RSG Recruiting Solutions Group GmbH · HRB 35951 Amtsgericht Wiesbaden · Geschäftsführer: Ricardo Serrano · IBAN: DE43 5107 0021 0980 9567 00 · BIC: DEUTDEFF510";

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"/>
<title>Personalvermittlungsvertrag – ${esc(p.customerName)}</title>
<style>
  @page{margin:16mm}
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#15192a;max-width:760px;margin:32px auto;padding:0 28px;line-height:1.55;font-size:13.5px}
  .brand{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:22px}
  .logo{font-weight:900;font-size:22px;letter-spacing:-.02em} .logo span{font-weight:900}
  .logo-img{height:46px;width:auto;display:block}
  h1{font-size:21px;margin:18px 0 16px;text-align:center} h2{font-size:15px;margin:0 0 10px;break-after:avoid}
  .parties{display:flex;gap:24px;margin:14px 0 6px;break-inside:avoid} .party{flex:1} .muted{color:#6b7280;font-size:12px}
  ol{margin:6px 0 6px 18px} p{margin:9px 0;orphans:3;widows:3}
  .agb{page-break-before:always}
  .sig{width:100%;border-collapse:collapse;margin-top:30px;break-inside:avoid} .sig td{width:50%;vertical-align:bottom;padding-right:22px}
  .sigbox{height:54px;display:flex;align-items:flex-end} .sig-img{max-height:74px;max-width:230px;margin-bottom:-6px}
  .sigline{border-bottom:1px solid #15192a;height:2px;margin-bottom:5px} .sigcap{font-size:11px;color:#6b7280}
  .legal{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;font-size:10.5px;color:#8a90a2;line-height:1.5}
  .btn{margin:22px 0;display:flex;gap:10px} button{background:#111;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer}
  button.sec{background:#eef1f6;color:#15192a} .hint{font-size:11px;color:#8a90a2;margin-top:-8px}
  @media print{.btn,.hint{display:none} body{margin:0;max-width:none;padding:0;font-size:12.5px}}
</style></head><body>
  <div class="brand">${logo}<div class="muted">Personalvermittlungsvertrag · ${esc(date)}</div></div>
  <h1>Allgemeiner Personalvermittlungsvertrag</h1>

  <div class="parties">
    <div class="party"><div class="muted">Zwischen der</div><strong>${esc(RSG.name)}</strong><br/>${esc(RSG.rep)}<br/>${esc(RSG.street)}<br/>${esc(RSG.city)}<br/><span class="muted">nachfolgend „RSG“ genannt</span></div>
    <div class="party"><div class="muted">und</div><strong>${esc(p.customerName)}</strong><br/>${customerAddr || '<span class="muted">— Adresse —</span>'}${p.contactName ? `<br/>z.Hd. ${esc(p.contactName)}` : ""}<br/><span class="muted">nachfolgend „Auftraggeber“ genannt</span></div>
  </div>
  <p class="muted">werden folgende Vereinbarungen über Personalvermittlungen getroffen:</p>

  ${beauftragung}
  <p><strong>§ 2 Vertragsbestandteil.</strong> Bestandteil dieses Vertrags sind die nachstehenden Allgemeinen Geschäftsbedingungen (AGB).</p>

  ${signatureBlock(place, date, p.signatureUrl)}
  <div class="agb">
  ${agb}
  ${signatureBlock(place, date, p.signatureUrl)}
  <p class="legal">${legal}</p>
  </div>

  <div class="btn">
    <button onclick="window.print()">Drucken / als PDF speichern</button>
    <button class="sec" onclick="window.close()">Schließen</button>
  </div>
  <p class="hint">Tipp: Im Druckdialog unter „Weitere Einstellungen“ die „Kopf- und Fußzeilen“ deaktivieren – dann ist das PDF komplett sauber (ohne Datum/URL).</p>
</body></html>`;
}
