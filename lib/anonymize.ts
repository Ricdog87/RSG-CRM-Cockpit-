"use server";

import Anthropic from "@anthropic-ai/sdk";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from "docx";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { AI } from "@/lib/ai/config";
import { extractJson } from "@/lib/ai/llm";

const BUCKET = "candidate-cvs";
const BRAND = "1D4ED8";

interface AnonProfile {
  headline: string;
  eckdaten: {
    position?: string;
    seniority?: string;
    experience?: string;
    availability?: string;
    location?: string;
    travel?: string;
    salary?: string;
    languages?: string;
  };
  profile: string;
  competencies: { group: string; items: string[] }[];
  projects: { title: string; desc: string }[];
  experience: { period: string; role: string; company_generic: string; desc: string }[];
  education: string[];
}

async function currentPartnerId(): Promise<{ id: string | null; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Keine aktive Session." };
  const { data, error } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) return { id: null, error: "Kein Partner-Profil gefunden." };
  return { id: data.id as string };
}

async function parseAnon(bytes: Uint8Array): Promise<AnonProfile | null> {
  if (AI.provider !== "anthropic" || !AI.anthropicKey) return null;
  const b64 = Buffer.from(bytes).toString("base64");
  const client = new Anthropic({ apiKey: AI.anthropicKey });
  const content: unknown[] = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
    {
      type: "text",
      text:
        "Erzeuge ein anonymisiertes Kurzprofil (Blindprofil) aus diesem Lebenslauf als JSON: " +
        '{ "headline": kurze Berufsüberschrift, "eckdaten": {"position","seniority",' +
        '"experience","availability","location","travel","salary","languages"}, "profile": ' +
        "2-4 Sätze Kurzprofil, " +
        '"competencies": [{"group": Kategorie, "items": [Begriffe]}], "projects": ' +
        '[{"title","desc"}], "experience": [{"period","role","company_generic","desc"}], ' +
        '"education": [Strings] }. ' +
        "WICHTIG: KEIN Name, KEINE Kontaktdaten, KEIN Geburtsdatum, KEINE Adresse. " +
        "Arbeitgeber- und Produktnamen generalisieren (z.B. 'mittelständischer Automobilzulieferer'). " +
        "Antworte nur mit dem JSON.",
    },
  ];
  const res = await client.messages.create({
    model: AI.model,
    max_tokens: 3000,
    system: "Du erstellst DSGVO-konforme, anonymisierte Kandidaten-Kurzprofile für die Personalvermittlung.",
    messages: [{ role: "user", content: content as unknown as Anthropic.MessageParam["content"] }],
  });
  const block = res.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  const j = extractJson<Partial<AnonProfile>>(raw);
  return {
    headline: String(j.headline ?? "Kandidatenprofil"),
    eckdaten: (j.eckdaten as AnonProfile["eckdaten"]) ?? {},
    profile: String(j.profile ?? ""),
    competencies: Array.isArray(j.competencies) ? (j.competencies as AnonProfile["competencies"]) : [],
    projects: Array.isArray(j.projects) ? (j.projects as AnonProfile["projects"]) : [],
    experience: Array.isArray(j.experience) ? (j.experience as AnonProfile["experience"]) : [],
    education: Array.isArray(j.education) ? (j.education as string[]).map(String) : [],
  };
}

// ---------- docx-Bausteine ----------

function bandHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    shading: { type: "clear", fill: BRAND, color: "auto" },
    children: [new TextRun({ text: ` ${text}`, bold: true, color: "FFFFFF", size: 24 })],
  });
}

function para(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 20, color: opts.color })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text, size: 20 })] });
}

function eckdatenTable(e: AnonProfile["eckdaten"]): Table {
  const rows: [string, string | undefined][] = [
    ["Position", e.position],
    ["Seniorität", e.seniority],
    ["Erfahrung", e.experience],
    ["Verfügbarkeit", e.availability],
    ["Standort", e.location],
    ["Reisebereitschaft", e.travel],
    ["Gehaltsvorstellung", e.salary],
    ["Sprachen", e.languages],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 32, type: WidthType.PERCENTAGE },
                children: [para(k, { bold: true })],
              }),
              new TableCell({ children: [para(String(v))] }),
            ],
          })
      ),
  });
}

function buildDocx(p: AnonProfile, candNo: string): Document {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      shading: { type: "clear", fill: BRAND, color: "auto" },
      children: [new TextRun({ text: " RSG · Anonymisiertes Kandidatenprofil", bold: true, color: "FFFFFF", size: 30 })],
    })
  );
  children.push(para(candNo, { color: "64748B" }));
  children.push(para(p.headline, { bold: true, size: 26 }));

  if (Object.values(p.eckdaten).some(Boolean)) {
    children.push(bandHeading("Eckdaten"));
    children.push(eckdatenTable(p.eckdaten));
  }
  if (p.profile) {
    children.push(bandHeading("Profil"));
    children.push(para(p.profile));
  }
  if (p.competencies.length) {
    children.push(bandHeading("Kernkompetenzen"));
    for (const c of p.competencies) {
      children.push(para(c.group, { bold: true }));
      for (const it of c.items) children.push(bullet(it));
    }
  }
  if (p.projects.length) {
    children.push(bandHeading("Ausgewählte Projekte (anonymisiert)"));
    for (const pr of p.projects) {
      children.push(para(pr.title, { bold: true }));
      if (pr.desc) children.push(para(pr.desc));
    }
  }
  if (p.experience.length) {
    children.push(bandHeading("Beruflicher Werdegang"));
    for (const ex of p.experience) {
      children.push(para(`${ex.period} · ${ex.role}`, { bold: true }));
      if (ex.company_generic) children.push(para(ex.company_generic, { color: "64748B" }));
      if (ex.desc) children.push(para(ex.desc));
    }
  }
  if (p.education.length) {
    children.push(bandHeading("Aus- & Weiterbildung"));
    for (const ed of p.education) children.push(bullet(ed));
  }

  children.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: "E2E8F0" } },
      children: [
        new TextRun({
          text:
            "Anonymisiert gem. Art. 5 & 6 DSGVO. Klardaten/Identität ausschließlich über RSG Recruiting Solutions Group GmbH.",
          size: 16,
          color: "64748B",
          italics: true,
        }),
      ],
    })
  );

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

export async function anonymizeCandidate(
  candidateId: string
): Promise<{ ok: boolean; error?: string; demo?: boolean; filename?: string; base64?: string }> {
  if (useMockData) return { ok: false, demo: true, error: "Demo-Modus – mit echter Supabase + KI verfügbar." };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  if (AI.provider !== "anthropic" || !AI.anthropicKey)
    return { ok: false, error: "KI nicht verbunden (ANTHROPIC_API_KEY fehlt)." };

  const supabase = createClient();
  const { data: cand } = await supabase
    .from("candidates")
    .select("cv_path, cv_filename, candidate_no")
    .eq("id", candidateId)
    .maybeSingle();
  const c = (cand as { cv_path?: string; cv_filename?: string; candidate_no?: number } | null) ?? null;
  if (!c?.cv_path) return { ok: false, error: "Kein CV hinterlegt." };
  if (!/\.pdf$/i.test(c.cv_filename ?? "")) return { ok: false, error: "Anonymisierung nur aus PDF-CV." };

  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(c.cv_path);
  if (dlErr || !file) return { ok: false, error: dlErr?.message ?? "CV nicht gefunden." };

  let profile: AnonProfile | null = null;
  try {
    profile = await parseAnon(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "KI-Analyse fehlgeschlagen." };
  }
  if (!profile) return { ok: false, error: "Kurzprofil konnte nicht erzeugt werden." };

  const candNo = c.candidate_no != null ? `Kandidaten-Nr. ${c.candidate_no}` : "RSG-Kurzprofil";
  const doc = buildDocx(profile, candNo);
  const base64 = await Packer.toBase64String(doc);
  const filename = `RSG-Kurzprofil-${c.candidate_no ?? candidateId.slice(0, 8)}.docx`;
  return { ok: true, filename, base64 };
}
