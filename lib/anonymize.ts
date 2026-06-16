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
  BorderStyle,
  ShadingType,
} from "docx";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { AI } from "@/lib/ai/config";

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
  const tool = {
    name: "anon_profile",
    description: "DSGVO-konformes anonymisiertes Kandidaten-Kurzprofil (Blindprofil).",
    input_schema: {
      type: "object",
      properties: {
        headline: { type: "string" },
        eckdaten: {
          type: "object",
          properties: {
            position: { type: "string" }, seniority: { type: "string" }, experience: { type: "string" },
            availability: { type: "string" }, location: { type: "string" }, travel: { type: "string" },
            salary: { type: "string" }, languages: { type: "string" },
          },
        },
        profile: { type: "string" },
        competencies: { type: "array", items: { type: "object", properties: { group: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["group", "items"] } },
        projects: { type: "array", items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" } }, required: ["title"] } },
        experience: { type: "array", items: { type: "object", properties: { period: { type: "string" }, role: { type: "string" }, company_generic: { type: "string" }, desc: { type: "string" } }, required: ["role"] } },
        education: { type: "array", items: { type: "string" } },
      },
      required: ["headline", "profile"],
    },
  };
  const res = await client.messages.create({
    model: AI.model,
    max_tokens: 8000,
    system:
      "Du erstellst DSGVO-konforme, anonymisierte Kandidaten-Kurzprofile fuer die Personalvermittlung. " +
      "KEIN Name, KEINE Kontaktdaten, KEIN Geburtsdatum, KEINE Adresse. " +
      "Arbeitgeber- und Produktnamen generalisieren.",
    tools: [tool] as unknown as Anthropic.Tool[],
    tool_choice: { type: "tool", name: "anon_profile" } as unknown as Anthropic.MessageCreateParams["tool_choice"],
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
          { type: "text", text: "Erzeuge aus diesem Lebenslauf das anonymisierte Kurzprofil und gib es ausschliesslich ueber das Tool 'anon_profile' zurueck. Arbeitgeber generalisieren, Klardaten weglassen." },
        ] as unknown as Anthropic.MessageParam["content"],
      },
    ],
  });
  const tu = res.content.find((b) => b.type === "tool_use");
  const j = (tu && tu.type === "tool_use" ? tu.input : {}) as Partial<AnonProfile>;
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

const INK = "1F2937";
const MUTED = "64748B";
const LINE = "E5E7EB";
const LIGHT = "F1F5F9";

/** Abschnitts-Band (blau, weiße Schrift, voller Breite mit Innenabstand). */
function bandHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 140, line: 300 },
    indent: { left: 140, right: 140 },
    shading: { type: ShadingType.CLEAR, fill: BRAND, color: "auto" },
    children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 24 })],
  });
}

function para(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; after?: number; italics?: boolean } = {}
): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 100, line: 276 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        size: opts.size ?? 21,
        color: opts.color ?? INK,
      }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40, line: 276 },
    children: [new TextRun({ text, size: 21, color: INK })],
  });
}

function cell(content: Paragraph, width: number, shaded = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 60, bottom: 60, left: 140, right: 140 },
    shading: shaded ? { type: ShadingType.CLEAR, fill: LIGHT, color: "auto" } : undefined,
    children: [content],
  });
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
  const b = { style: BorderStyle.SINGLE, size: 2, color: LINE };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3200, 6600],
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
    rows: rows
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          new TableRow({
            children: [
              cell(para(k, { bold: true, after: 0 }), 32, true),
              cell(para(String(v), { after: 0 }), 68),
            ],
          })
      ),
  });
}

function buildDocx(p: AnonProfile, candNo: string): Document {
  const children: (Paragraph | Table)[] = [];

  // Kopf-Band
  children.push(
    new Paragraph({
      spacing: { after: 60, line: 360 },
      indent: { left: 140, right: 140 },
      shading: { type: ShadingType.CLEAR, fill: BRAND, color: "auto" },
      children: [
        new TextRun({ text: "RSG · Anonymisiertes Kandidatenprofil", bold: true, color: "FFFFFF", size: 30 }),
      ],
    })
  );
  children.push(para(candNo, { color: MUTED, size: 18, after: 60 }));
  children.push(para(p.headline, { bold: true, size: 28, after: 100 }));

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
      children.push(para(c.group, { bold: true, after: 40 }));
      for (const it of c.items) children.push(bullet(it));
    }
  }
  if (p.projects.length) {
    children.push(bandHeading("Ausgewählte Projekte (anonymisiert)"));
    for (const pr of p.projects) {
      children.push(para(pr.title, { bold: true, after: 40 }));
      if (pr.desc) children.push(para(pr.desc, { after: 140 }));
    }
  }
  if (p.experience.length) {
    children.push(bandHeading("Beruflicher Werdegang"));
    for (const ex of p.experience) {
      children.push(para(`${ex.period} · ${ex.role}`, { bold: true, after: 20 }));
      if (ex.company_generic) children.push(para(ex.company_generic, { color: MUTED, size: 19, after: 40 }));
      if (ex.desc) children.push(para(ex.desc, { after: 140 }));
    }
  }
  if (p.education.length) {
    children.push(bandHeading("Aus- & Weiterbildung"));
    for (const ed of p.education) children.push(bullet(ed));
  }

  children.push(
    new Paragraph({
      spacing: { before: 360, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
      children: [
        new TextRun({
          text:
            "Anonymisiert gem. Art. 5 & 6 DSGVO. Klardaten/Identität ausschließlich über RSG Recruiting Solutions Group GmbH.",
          size: 16,
          color: MUTED,
          italics: true,
        }),
      ],
    })
  );

  return new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 21, color: INK } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
        children,
      },
    ],
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
