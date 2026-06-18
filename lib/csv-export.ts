/**
 * Client-seitiger CSV-Export (Excel-freundlich: UTF-8-BOM + Semikolon-Trennung,
 * wie deutsche Excel-Standardeinstellung). Keine Server-Imports.
 */
export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  get?: (row: T) => unknown;
}

function escapeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[]
): void {
  const header = columns.map((c) => escapeCell(c.label)).join(";");
  const body = rows
    .map((r) =>
      columns
        .map((c) => escapeCell(c.get ? c.get(r) : (r as Record<string, unknown>)[c.key as string]))
        .join(";")
    )
    .join("\r\n");
  const csv = "﻿" + header + "\r\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
