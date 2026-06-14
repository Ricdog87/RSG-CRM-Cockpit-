import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete } from "@/lib/ai/llm";
import { getCockpitData } from "@/lib/data";
import {
  getAccounts,
  getOpportunities,
  getKiProjects,
  getMandates,
  getCandidates,
} from "@/lib/crm-data";
import { formatEur } from "@/lib/format";

const SYSTEM = `Du bist der CRM-Co-Pilot von RSG (Recruiting Solutions Group).
Beantworte Fragen der Vertriebspartner:in AUSSCHLIESSLICH anhand des unten bereitgestellten Kontexts (echte Zahlen).
Wenn die Information im Kontext fehlt, sag das ehrlich – erfinde keine Daten.
Antworte knapp und konkret auf Deutsch, nenne Zahlen, und gib bei Handlungsfragen eine klare Empfehlung.`;

/** Baut einen kompakten, geerdeten Kontext-Snapshot aus den CRM-Daten. */
async function buildContext(): Promise<string> {
  const [cockpit, accounts, opps, ki, mandates, candidates] = await Promise.all([
    getCockpitData(),
    getAccounts(),
    getOpportunities(),
    getKiProjects(),
    getMandates(),
    getCandidates(),
  ]);

  const open = opps.filter((o) => o.stage !== "gewonnen" && o.stage !== "verloren");
  const weighted = open.reduce((s, o) => s + (o.value * o.probability) / 100, 0);
  const topOpps = [...open]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map(
      (o) =>
        `  • ${o.account_name} – ${o.title} (${o.line}, ${o.stage}, ${formatEur(o.value)}${o.value_type === "mrr" ? "/M" : ""}, ${o.probability}%)`
    )
    .join("\n");

  const openPositions = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled),
    0
  );
  const openVolume = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled) * m.fee,
    0
  );

  return [
    "== Eigener Bestand (Partner) ==",
    `Aktive Kund:innen: ${cockpit.bestand.aktive_kunden}`,
    `Wiederkehrender Bestand (MRR): ${formatEur(cockpit.bestand.mrr_bestand)}`,
    `Monatl. Bestandsprovision: ${formatEur(cockpit.bestand.monatl_bestandsprovision)}`,
    `Provision laufender Monat: ${formatEur(cockpit.provisionAktuellerMonat)}`,
    `Offen freigegeben: ${formatEur(cockpit.earnings.offen_freigegeben)} · Stornoreserve: ${formatEur(cockpit.earnings.in_stornoreserve)} · Override pausiert: ${formatEur(cockpit.earnings.override_pausiert)}`,
    `Karrierestufe: ${cockpit.career.current.name} (Stufe ${cockpit.career.current.level})`,
    `Team: ${cockpit.downline.length} Direktpartner:innen, davon ${cockpit.downline.filter((d) => d.is_active).length} aktiv`,
    "",
    "== CRM Vertrieb & Projekte ==",
    `Accounts: ${accounts.length} (KI: ${accounts.filter((a) => a.line === "ki").length}, Recruiting: ${accounts.filter((a) => a.line === "recruiting").length})`,
    `Offene Verkaufschancen: ${open.length} · gewichtetes Potenzial: ${formatEur(weighted)}`,
    "Top offene Chancen:",
    topOpps || "  (keine)",
    `KI-Projekte: ${ki.filter((p) => p.status === "live").length} live, ${ki.filter((p) => p.status === "onboarding").length} im Onboarding`,
    `Recruiting: ${openPositions} offene Stellen, Volumen ${formatEur(openVolume)}`,
    `Kandidaten: ${candidates.filter((c) => c.stage !== "platziert" && c.stage !== "abgelehnt").length} aktiv, ${candidates.filter((c) => c.stage === "interview").length} in Interviews, ${candidates.filter((c) => c.stage === "platziert").length} platziert`,
  ].join("\n");
}

/** Beantwortet eine Frage zum eigenen CRM. Ohne API-Key → Kontext-Snapshot. */
export async function askCopilot(
  question: string
): Promise<{ answer: string; mode: "live" | "demo" }> {
  const context = await buildContext();

  if (!aiConfigured) {
    return {
      answer:
        "KI ist nicht verbunden (Demo-Modus). Hier dein aktueller Stand:\n\n" +
        context +
        "\n\nMit ANTHROPIC_API_KEY beantworte ich deine Frage in natürlicher Sprache.",
      mode: "demo",
    };
  }

  const answer = await llmComplete(
    SYSTEM,
    `Kontext (aktuelle Zahlen):\n${context}\n\nFrage der Partner:in: ${question}`
  );
  return { answer: answer.trim() || "Dazu finde ich im Kontext keine Antwort.", mode: "live" };
}
