"use client";

import { useEffect, useState } from "react";

const QUOTES = [
  "Jeder Anruf bringt dich näher zum nächsten Abschluss.",
  "Champions machen die Calls, die andere aufschieben.",
  "Pipeline schlägt Talent – fülle sie, jeden Tag.",
  "Du verkaufst keine Produkte, du verkaufst Ergebnisse.",
  "Ein „Nein“ bringt dich näher zum nächsten „Ja“.",
  "Heute 15 Calls. Morgen 15 Chancen. Übermorgen Abschlüsse.",
  "Nicht warten – wählen. Der nächste Deal wartet auf deinen Anruf.",
  "Konstanz schlägt Intensität. Bleib dran, Tag für Tag.",
  "Der Markt belohnt Mut. Greif zum Hörer.",
  "Mach heute den Call, von dem du morgen profitierst.",
  "Verkaufen heißt helfen – zeig ihnen, was möglich ist.",
  "Dein Fokus heute ist dein Umsatz nächsten Monat.",
];

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function greet(h: number): { text: string; emoji: string } {
  if (h < 5) return { text: "Noch wach", emoji: "🌙" };
  if (h < 11) return { text: "Guten Morgen", emoji: "☀️" };
  if (h < 14) return { text: "Mahlzeit", emoji: "🍽️" };
  if (h < 18) return { text: "Guten Tag", emoji: "💪" };
  if (h < 22) return { text: "Guten Abend", emoji: "🌆" };
  return { text: "Späte Schicht", emoji: "🌙" };
}

export function DashboardHero({
  name,
  goalsDone = 0,
  streak = 0,
  dayMode = "work",
}: {
  name: string;
  goalsDone?: number;
  streak?: number;
  dayMode?: "work" | "review" | "off";
}) {
  const firstName = (name || "").trim().split(" ")[0] || "Champion";
  const [now, setNow] = useState<Date | null>(null);
  const [qi, setQi] = useState(0);

  // Performance-gekoppelte Ansage – schlägt den rotierenden Spruch.
  function perfMessage(): string | null {
    if (dayMode === "off") return `Wochenende – Energie tanken, ${firstName}. Montag wird stark. 🌟`;
    if (dayMode === "review") return "Review-Tag: Bilanz ziehen, Forecast schärfen, Woche krönen.";
    if (goalsDone >= 4)
      return streak >= 3
        ? `🔥 Unstoppable! ${streak} Tage in Folge alle Ziele – du bist on fire!`
        : "🔥 4/4 – du bist heute on fire!";
    if (streak >= 3) return `🔥 ${streak}-Tage-Streak läuft – heute dranbleiben, ${firstName}!`;
    if (goalsDone === 3) return "3/4 – nur noch ein Ziel. Finish strong! 💪";
    if (goalsDone === 2) return `Halbzeit erreicht – Tempo halten, ${firstName}!`;
    if (goalsDone === 1) return "Erster Punkt steht. Jetzt nachlegen! 👊";
    return null; // 0/4 am Arbeitstag → rotierender Motivationsspruch
  }

  useEffect(() => {
    setNow(new Date());
    // Tagesbasierter Start-Spruch, dann Rotation.
    const seed = Math.floor(Date.now() / 86400000) % QUOTES.length;
    setQi(seed);
    const clock = setInterval(() => setNow(new Date()), 1000);
    const rot = setInterval(() => setQi((i) => (i + 1) % QUOTES.length), 9000);
    return () => {
      clearInterval(clock);
      clearInterval(rot);
    };
  }, []);

  const g = greet(now ? now.getHours() : 9);
  const dateStr = now
    ? `${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
    : "";
  const timeStr = now
    ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
    : "";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand via-brand-deep to-sky-deep px-5 py-5 text-white shadow-glow sm:px-7 sm:py-6">
      {/* Deko-Glows */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 right-24 h-32 w-32 rounded-full bg-sky/30 blur-2xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            RSG Sales-Cockpit
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            {g.text}, {firstName} {g.emoji}
          </h1>
          <p className="mt-2 max-w-xl text-sm font-semibold text-white sm:text-base">
            {perfMessage() ?? QUOTES[qi]}
          </p>
        </div>

        <div className="flex-none rounded-xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
          <p className="text-xs font-medium text-white/80">{dateStr || " "}</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums">{timeStr || " "}</p>
        </div>
      </div>
    </div>
  );
}
