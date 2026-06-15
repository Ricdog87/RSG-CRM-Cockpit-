"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { IconFolder, IconCheck, IconAlert } from "@/components/ui/icons";
import { parseCsv } from "@/lib/csv";
import { IMPORT_OBJECTS, findImportObject, guessColumn } from "@/lib/import-config";
import { importRows, type ImportResult } from "@/lib/import-actions";

const IGNORE = -1;

export function ImportWizard() {
  const [objectKey, setObjectKey] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [dedupe, setDedupe] = useState<string>("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const obj = findImportObject(objectKey);

  function selectObject(key: string) {
    setObjectKey(key);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFileName("");
    setResult(null);
    const o = findImportObject(key);
    if (o) setDedupe(o.dedupe[0]?.key ?? "");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !obj) return;
    setResult(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setFileName(file.name);
    // Auto-Mapping
    const m: Record<string, number> = {};
    for (const f of obj.fields) m[f.key] = guessColumn(f, parsed.headers);
    m["id"] = guessColumn({ key: "id", label: "Datensatz-ID", hints: ["id", "record id", "datensatz-id", "datensatzid"] }, parsed.headers);
    setMapping(m);
  }

  const requiredMissing = useMemo(
    () => (obj ? obj.fields.filter((f) => f.required && (mapping[f.key] ?? IGNORE) < 0) : []),
    [obj, mapping]
  );
  const canImport = obj && rows.length > 0 && requiredMissing.length === 0 && !pending;

  function runImport() {
    if (!obj) return;
    setResult(null);
    start(async () => {
      const res = await importRows({
        object: obj.key,
        mapping,
        dedupe,
        updateExisting,
        rows,
      });
      setResult(res);
    });
  }

  const preview = rows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1) Objekt wählen */}
      <Card>
        <CardBody>
          <SectionHeader title="1 · Was möchtest du importieren?" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_OBJECTS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => selectObject(o.key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  objectKey === o.key
                    ? "border-brand bg-brand/[0.06] ring-1 ring-brand/30"
                    : "border-border bg-elevated/40 hover:border-brand/40"
                )}
              >
                <p className="text-sm font-semibold text-ink">{o.label}</p>
                <p className="mt-0.5 text-xs text-muted">{o.description}</p>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* 2) Datei hochladen */}
      {obj ? (
        <Card>
          <CardBody>
            <SectionHeader
              title="2 · CSV-Datei hochladen"
              hint="erste Zeile = Spaltenüberschriften · Komma oder Semikolon"
            />
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-elevated/40 px-6 py-8 text-center hover:border-brand/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand-deep">
                <IconFolder size={20} />
              </span>
              <span className="text-sm font-medium text-ink">
                {fileName || "CSV auswählen oder hierher ziehen"}
              </span>
              {rows.length > 0 ? (
                <span className="text-xs text-muted">
                  {rows.length} Datenzeilen · {headers.length} Spalten erkannt
                </span>
              ) : (
                <span className="text-xs text-faint">.csv</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="hidden"
              />
            </label>
          </CardBody>
        </Card>
      ) : null}

      {/* 3) Spalten zuordnen */}
      {obj && headers.length > 0 ? (
        <Card>
          <CardBody>
            <SectionHeader title="3 · Spalten zuordnen" hint="automatisch vorbelegt – bei Bedarf anpassen" />
            <div className="space-y-2">
              {obj.fields.map((f) => (
                <div key={f.key} className="flex flex-wrap items-center gap-2">
                  <span className="w-full text-sm text-ink sm:w-64">
                    {f.label}
                    {f.required ? <span className="text-danger"> *</span> : null}
                  </span>
                  <select
                    value={mapping[f.key] ?? IGNORE}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <option value={IGNORE}>— ignorieren —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {/* Datensatz-ID (für Abgleich) */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                <span className="w-full text-sm text-muted sm:w-64">Datensatz-ID (optional)</span>
                <select
                  value={mapping["id"] ?? IGNORE}
                  onChange={(e) => setMapping((m) => ({ ...m, id: Number(e.target.value) }))}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <option value={IGNORE}>— ignorieren —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Abgleich / Dubletten */}
            <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Dubletten erkennen über
                </label>
                <select
                  value={dedupe}
                  onChange={(e) => setDedupe(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {obj.dedupe.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-end gap-2 pb-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                  disabled={!dedupe}
                />
                Vorhandene Datensätze aktualisieren
              </label>
            </div>

            {requiredMissing.length > 0 ? (
              <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Bitte Pflichtfeld(er) zuordnen: {requiredMissing.map((f) => f.label).join(", ")}
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {/* 4) Vorschau */}
      {obj && preview.length > 0 ? (
        <Card>
          <CardBody>
            <SectionHeader title="4 · Vorschau" hint="erste Zeilen mit aktueller Zuordnung" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-faint">
                  <tr>
                    {obj.fields.map((f) => (
                      <th key={f.key} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {preview.map((r, ri) => (
                    <tr key={ri}>
                      {obj.fields.map((f) => {
                        const col = mapping[f.key] ?? IGNORE;
                        return (
                          <td key={f.key} className="max-w-[12rem] truncate px-2 py-1.5 text-ink">
                            {col >= 0 ? r[col] : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {rows.length} Zeilen bereit zum Import in <b className="text-ink">{obj.label}</b>.
              </p>
              <Button onClick={runImport} disabled={!canImport}>
                {pending ? "Importiere …" : `Import starten`}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* 5) Ergebnis */}
      {result ? (
        <Card>
          <CardBody>
            <SectionHeader title="Ergebnis" />
            {result.ok ? (
              <>
                {result.demo ? (
                  <Badge tone="warning">
                    Demo-Modus: {result.created} Zeilen erkannt, aber nicht gespeichert (Supabase nötig).
                  </Badge>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Stat label="Angelegt" value={result.created} tone="success" />
                    <Stat label="Aktualisiert" value={result.updated} tone="sky" />
                    <Stat label="Übersprungen" value={result.skipped} tone="neutral" />
                    <Stat label="Fehler" value={result.errors.length} tone={result.errors.length ? "danger" : "neutral"} />
                  </div>
                )}
                {result.errors.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-medium text-muted">
                      Fehler (erste {Math.min(result.errors.length, 12)}):
                    </p>
                    <ul className="space-y-1 text-xs text-danger">
                      {result.errors.slice(0, 12).map((e, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <IconAlert size={13} className="mt-0.5 flex-none" />
                          Zeile {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-success">
                    <IconCheck size={15} /> Import abgeschlossen.
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {result.error}
              </p>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "sky" | "neutral" | "danger";
}) {
  const ring: Record<string, string> = {
    success: "border-success/30 bg-success/10 text-success",
    sky: "border-sky/30 bg-sky/10 text-sky-deep",
    neutral: "border-border bg-elevated text-muted",
    danger: "border-danger/30 bg-danger/10 text-danger",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-2.5", ring[tone])}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
