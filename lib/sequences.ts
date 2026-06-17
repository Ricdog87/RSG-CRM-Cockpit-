/**
 * Outbound-Sequenzen: vordefinierte Nachfass-Kadenzen für Kandidat:innen.
 * Beim „Aufnehmen" werden die Schritte als Aufgaben (crm_tasks) mit
 * Fälligkeitsdatum = heute + dayOffset angelegt.
 */
export type SequenceChannel = "anruf" | "email" | "linkedin" | "whatsapp";

export interface SequenceStep {
  dayOffset: number;
  channel: SequenceChannel;
  title: string;
  /** Optionale Nachrichtenvorlage zum Kopieren. {name} wird ersetzt. */
  template?: string;
}

/** Zielgruppe der Sequenz: Kandidat:in (Recruiting) oder Account (B2B-Akquise). */
export type SequenceAudience = "candidate" | "account";

export interface Sequence {
  key: string;
  name: string;
  description: string;
  steps: SequenceStep[];
  /** Standard: candidate (Rückwärtskompatibilität). */
  audience?: SequenceAudience;
}

export const channelLabel: Record<SequenceChannel, string> = {
  anruf: "Anruf",
  email: "E-Mail",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

export const SEQUENCES: Sequence[] = [
  {
    key: "kandidat_nachfass",
    name: "Kandidaten-Nachfass",
    description: "4-Schritt-Kadenz nach dem Erstkontakt (Anruf → E-Mail → LinkedIn → Anruf).",
    steps: [
      { dayOffset: 0, channel: "anruf", title: "Erstkontakt anrufen" },
      {
        dayOffset: 2,
        channel: "email",
        title: "Position & nächste Schritte per E-Mail",
        template:
          "Hallo {name},\n\nschön, dass wir gesprochen haben. Anbei die wichtigsten Eckdaten zur Position. Wann passt Ihnen ein kurzes Video-Gespräch diese Woche?\n\nBeste Grüße",
      },
      {
        dayOffset: 5,
        channel: "linkedin",
        title: "LinkedIn-Nachfass / vernetzen",
        template: "Hallo {name}, ich hatte Ihnen per E-Mail eine spannende Position geschickt – passt ein kurzer Austausch?",
      },
      { dayOffset: 9, channel: "anruf", title: "Telefonischer Nachfass" },
    ],
  },
  {
    key: "reaktivierung",
    name: "Talent-Reaktivierung",
    description: "Bestehende Kandidat:innen (Pool/Silver Medalist) für neue Mandate reaktivieren.",
    steps: [
      {
        dayOffset: 0,
        channel: "email",
        title: "Reaktivierungs-E-Mail",
        template:
          "Hallo {name},\n\nwir hatten vor einiger Zeit Kontakt. Aktuell habe ich eine Position, die sehr gut zu Ihrem Profil passen könnte. Sind Sie offen für ein kurzes Gespräch?\n\nBeste Grüße",
      },
      { dayOffset: 3, channel: "anruf", title: "Nachtelefonieren" },
      { dayOffset: 8, channel: "whatsapp", title: "WhatsApp-Erinnerung" },
    ],
  },
  {
    key: "nach_interview",
    name: "Nach Interview",
    description: "Sauberes Follow-up nach dem Kundengespräch.",
    steps: [
      { dayOffset: 0, channel: "anruf", title: "Debrief-Anruf nach Interview" },
      {
        dayOffset: 1,
        channel: "email",
        title: "Feedback & Ausblick per E-Mail",
        template: "Hallo {name},\n\nvielen Dank für das Gespräch! Hier eine kurze Zusammenfassung der nächsten Schritte …",
      },
      { dayOffset: 4, channel: "anruf", title: "Entscheidungs-Nachfass" },
    ],
  },
];

// ── B2B-Kaltakquise-Kadenzen (Zielgruppe: Account/Entscheider) ──────────
SEQUENCES.push(
  {
    key: "akquise_ki",
    name: "Kaltakquise – RSG AI",
    description: "B2B-Erstansprache für die KI-Telefonassistenz (Anruf → E-Mail → LinkedIn → Anruf).",
    audience: "account",
    steps: [
      { dayOffset: 0, channel: "anruf", title: "Entscheider:in anrufen – Erreichbarkeit/verpasste Anrufe ansprechen" },
      {
        dayOffset: 1,
        channel: "email",
        title: "Value-Mail: verlorene Anrufe = verlorener Umsatz",
        template:
          "Hallo {name},\n\nviele Anfragen gehen außerhalb der Sprechzeiten oder in Stoßzeiten verloren. Unsere KI-Telefonassistenz nimmt jeden Anruf an, qualifiziert und bucht Termine – 24/7.\n\nPasst ein kurzer 15-Minuten-Call diese Woche, um den Nutzen für {company} konkret zu zeigen?\n\nBeste Grüße",
      },
      { dayOffset: 4, channel: "linkedin", title: "Auf LinkedIn vernetzen + kurzer Hinweis" },
      { dayOffset: 8, channel: "anruf", title: "Telefonischer Nachfass + Demo anbieten" },
    ],
  },
  {
    key: "akquise_recruiting",
    name: "Kaltakquise – RSG Recruiting",
    description: "B2B-Erstansprache für Personalvermittlung zum Festpreis (Anruf → E-Mail → Anruf).",
    audience: "account",
    steps: [
      { dayOffset: 0, channel: "anruf", title: "Entscheider:in anrufen – offene Vakanzen erfragen" },
      {
        dayOffset: 2,
        channel: "email",
        title: "Festpreis-Vermittlung vorstellen",
        template:
          "Hallo {name},\n\noffene Stellen kosten täglich Geld. Wir besetzen Vakanzen zum planbaren Festpreis – ohne Prozent-Risiko.\n\nWelche Position ist bei {company} aktuell am dringendsten? Dann zeige ich Ihnen passende Profile.\n\nBeste Grüße",
      },
      { dayOffset: 6, channel: "anruf", title: "Nachfass + konkrete Bedarfsklärung" },
    ],
  }
);

export function getSequence(key: string): Sequence | undefined {
  return SEQUENCES.find((s) => s.key === key);
}

/** Sequenzen einer Zielgruppe (Default-Audience = candidate). */
export function sequencesFor(audience: SequenceAudience): Sequence[] {
  return SEQUENCES.filter((s) => (s.audience ?? "candidate") === audience);
}
