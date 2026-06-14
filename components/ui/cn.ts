/** Minimaler Klassen-Joiner (kein extra Dependency nötig). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
