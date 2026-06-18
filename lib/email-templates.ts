/**
 * Vorbereitete E-Mail-Vorlagen (deutsch, B2B) für den direkten Versand aus dem
 * CRM. Die Anrede wird automatisch aus den Kundendaten gebildet. Reine
 * Funktionen – clientseitig nutzbar (Versand via E-Mail-Programm / mailto).
 */
export interface EmailContext {
  greeting: string;
  company: string;
  senderName: string;
}

export interface EmailTemplate {
  key: string;
  label: string;
  line?: "ki" | "recruiting";
  /** true ⇒ setzt nach Versand den Vertragsstatus auf „versendet“. */
  marksContractSent?: boolean;
  build: (c: EmailContext) => { subject: string; body: string };
}

function signoff(sender: string): string {
  return `\n\nMit freundlichen Grüßen\n${sender}\nRSG Recruiting Solutions Group`;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: "vertrag",
    label: "Vertrag zur Unterschrift senden",
    line: "recruiting",
    marksContractSent: true,
    build: (c) => ({
      subject: `Personalvermittlungsvertrag – ${c.company}`,
      body:
        `${c.greeting}\n\n` +
        `vielen Dank für Ihre Beauftragung und das entgegengebrachte Vertrauen.\n\n` +
        `Anbei erhalten Sie wie besprochen unseren Personalvermittlungsvertrag mit der höflichen Bitte um Unterschrift und Rücksendung. ` +
        `Nach Eingang der Anzahlung starten wir umgehend mit der Suche und halten Sie über die Fortschritte auf dem Laufenden.\n\n` +
        `Für Rückfragen stehe ich Ihnen jederzeit gern zur Verfügung.` +
        signoff(c.senderName),
    }),
  },
  {
    key: "danke_beauftragung",
    label: "Dank für Beauftragung",
    line: "recruiting",
    build: (c) => ({
      subject: `Vielen Dank für Ihre Beauftragung – ${c.company}`,
      body:
        `${c.greeting}\n\n` +
        `herzlichen Dank für Ihre Beauftragung. Wir freuen uns auf die Zusammenarbeit und starten umgehend mit der Suche nach den passenden Kandidat:innen.\n\n` +
        `Sie erhalten in Kürze einen ersten Zwischenstand. Bei Fragen erreichen Sie mich jederzeit.` +
        signoff(c.senderName),
    }),
  },
  {
    key: "kandidaten",
    label: "Kandidat:innen vorstellen",
    line: "recruiting",
    build: (c) => ({
      subject: `Kandidatenvorschläge – ${c.company}`,
      body:
        `${c.greeting}\n\n` +
        `anbei stelle ich Ihnen passende Kandidat:innen für Ihre Vakanz vor. Die Profile sind auf Ihr Anforderungsprofil abgestimmt.\n\n` +
        `Gerne stimmen wir die nächsten Schritte (z. B. Interviewtermine) in einem kurzen Telefonat ab. Wann passt es Ihnen diese Woche?` +
        signoff(c.senderName),
    }),
  },
  {
    key: "nachfass",
    label: "Nachfassen / Follow-up",
    build: (c) => ({
      subject: `Kurzes Update – ${c.company}`,
      body:
        `${c.greeting}\n\n` +
        `ich komme kurz auf unser letztes Gespräch zurück und wollte mich nach dem aktuellen Stand erkundigen.\n\n` +
        `Haben Sie diese Woche 15 Minuten für einen kurzen Austausch? Dann besprechen wir die nächsten Schritte.` +
        signoff(c.senderName),
    }),
  },
  {
    key: "termin",
    label: "Terminvorschlag",
    build: (c) => ({
      subject: `Terminvorschlag – ${c.company}`,
      body:
        `${c.greeting}\n\n` +
        `gerne würde ich die nächsten Schritte in einem kurzen Telefonat mit Ihnen besprechen.\n\n` +
        `Passt Ihnen ein Termin diese oder nächste Woche? Schlagen Sie mir gerne zwei, drei Zeitfenster vor – ich richte mich nach Ihnen.` +
        signoff(c.senderName),
    }),
  },
  {
    key: "ki_erstkontakt",
    label: "KI – Erstansprache",
    line: "ki",
    build: (c) => ({
      subject: `Verpasste Anrufe automatisch abfangen – ${c.company}`,
      body:
        `${c.greeting}\n\n` +
        `viele Anfragen gehen außerhalb der Sprechzeiten oder in Stoßzeiten verloren. Unsere KI-Telefonassistenz nimmt jeden Anruf an, qualifiziert und bucht Termine – rund um die Uhr.\n\n` +
        `In einem kurzen 15-minütigen Call zeige ich Ihnen konkret, welchen Mehrwert das für ${c.company} bringt. Wann passt es Ihnen?` +
        signoff(c.senderName),
    }),
  },
];

/** Bildet eine passende Anrede aus Anrede + Name. */
export function buildGreeting(opts: { salutation?: string; name?: string }): string {
  const sal = (opts.salutation || "").trim().toLowerCase();
  const name = (opts.name || "").trim();
  const last = name ? name.split(/\s+/).slice(-1)[0] : "";
  if ((sal === "herr" || sal === "herrn") && last) return `Sehr geehrter Herr ${last},`;
  if (sal === "frau" && last) return `Sehr geehrte Frau ${last},`;
  if (name) return `Guten Tag ${name},`;
  return "Sehr geehrte Damen und Herren,";
}
