/**
 * Robuster CSV-Parser (client-safe). Erkennt das Trennzeichen (Komma oder
 * Semikolon – deutsche Exporte nutzen oft „;"), behandelt Anführungszeichen,
 * eingebettete Trennzeichen/Zeilenumbrüche und doppelte Quotes ("").
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  let best = ",";
  for (const d of [";", "\t", ","]) if (counts[d] > counts[best]) best = d;
  return best;
}

export function parseCsv(input: string): ParsedCsv {
  // BOM entfernen
  const text = input.replace(/^﻿/, "");
  const firstNl = text.search(/\r?\n/);
  const firstLine = firstNl >= 0 ? text.slice(0, firstNl) : text;
  const delimiter = detectDelimiter(firstLine);

  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignorieren (CRLF) – das \n schließt die Zeile ab
    } else {
      field += ch;
    }
  }
  // letztes Feld/Zeile
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  // leere Zeilen am Ende entfernen
  const cleaned = records.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (cleaned.shift() ?? []).map((h) => h.trim());
  return { headers, rows: cleaned, delimiter };
}
