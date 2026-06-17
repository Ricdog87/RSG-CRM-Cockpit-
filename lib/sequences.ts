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

export interface Sequence {
  key: string;
  name: string;
  description: string;
  steps: SequenceStep[];
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

export function getSequence(key: string): Sequence | undefined {
  return SEQUENCES.find((s) => s.key === key);
}
