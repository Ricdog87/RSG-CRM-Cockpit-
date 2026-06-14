/** Deutsche Formatierungs-Helfer (€, Zahlen, Daten). */

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurCents = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("de-DE");

export function formatEur(value: number, withCents = false): string {
  if (!Number.isFinite(value)) return "–";
  return withCents ? eurCents.format(value) : eur.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return num.format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return `${num.format(Math.round(value))} %`;
}

export function formatDate(value: string | null): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Relatives Monatslabel, z.B. "+8 %" mit Vorzeichen. */
export function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${num.format(Math.round(value))} %`;
}
