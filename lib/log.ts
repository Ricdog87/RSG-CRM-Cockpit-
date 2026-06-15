import "server-only";

/**
 * Zentrales serverseitiges Logging für Datenzugriffs-/Automation-Fehler.
 * Erscheint in den Vercel-Server-Logs, niemals im Client-Bundle (server-only).
 * Gibt KEINE Secrets aus – nur Scope + Fehlermeldung/-code.
 */
export function logDataError(scope: string, error: unknown): void {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? ` [${String((error as { code: unknown }).code)}]`
      : "";
  console.error(`[RSG:${scope}]${code} ${msg}`);
}

/**
 * True, wenn der Supabase-/Postgres-Fehler „Relation existiert nicht" bedeutet
 * (Code 42P01) – d.h. die Migration ist noch nicht eingespielt. In diesem Fall
 * ist der Mock-/Leer-Fallback erwartbar und sollte NICHT als Fehler geloggt
 * werden.
 */
export function isMissingTable(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}
