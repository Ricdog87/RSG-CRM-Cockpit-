"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Kleines Google-G-Icon (inline SVG, kein externesImage-Dependency).
function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Verbunden-Zustand ────────────────────────────────────────────────────────

function ConnectedBadge({ onDisconnect }: { onDisconnect: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      onDisconnect();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Google Kalender verbunden
      </span>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={loading}
        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-60"
      >
        {loading ? "Trennen …" : "Trennen"}
      </button>
    </div>
  );
}

// ─── Nicht-verbunden-Zustand ───────────────────────────────────────────────────

function ConnectButton() {
  return (
    <a
      href="/api/google/connect"
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition-all hover:border-brand/40 hover:shadow"
    >
      <GoogleIcon size={16} />
      Mit Google Kalender verbinden
    </a>
  );
}

// ─── Fehler-Banner ────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Google-ENV nicht konfiguriert (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET fehlen in Vercel).",
  no_partner: "Kein Partner-Profil gefunden. Bitte Support kontaktieren.",
  access_denied: "Verbindung abgebrochen — du hast die Berechtigung verweigert.",
  no_refresh_token: "Kein Refresh-Token erhalten. Bitte erneut verbinden.",
  token_exchange: "Fehler beim Token-Austausch. Bitte erneut versuchen.",
  missing_params: "Ungültige Callback-Parameter.",
};

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

/**
 * GoogleCalendarConnect
 *
 * Zeigt den Verbindungsstatus und den passenden Button.
 * Wird in die Kalender-Seite eingebettet (Server Component übergibt Props).
 *
 * Props:
 *   connected    — Google-Token in DB vorhanden?
 *   configured    └ GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET gesetzt?
 *   error        — Fehlermeldung aus URL-Param (z.B. nach fehlgeschlagenem OAuth)
 *   justConnected —"?google_connected=1" → Erfolgs-Toast anzeigen
 */
export function GoogleCalendarConnect({
  connected,
  configured,
  error,
  justConnected,
}: {
  connected: boolean;
  configured: boolean;
  error?: string | null;
  justConnected?: boolean;
}) {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(connected);

  function handleDisconnect() {
    setIsConnected(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Erfolgs-Meldung nach OAuth-Redirect */}
      {justConnected && (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/[0.08] px-3 py-2 text-sm text-success">
          <span>✓</span>
          <span>Google Kalender erfolgreich verbunden. Deine CRM-Aufgaben werden ab jetzt automatisch synchronisiert.</span>
        </div>
      )}

      {/* Fehler-Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">
          <span>⚠</span>
          <span>{ERROR_MESSAGES[error] ?? `Fehler: ${error}`}</span>
        </div>
      )}

      {/* Connect / Connected */}
      {isConnected ? (
        <ConnectedBadge onDisconnect={handleDisconnect} />
      ) : configured ? (
        <ConnectButton />
      ) : (
        <p className="text-xs text-faint">
          2-Wege-Sync nicht verfügbar — Google-API-Key fehlt in Vercel.
          <span className="ml-1 font-mono">GOOGLE_CLIENT_ID</span> /
          <span className="ml-1 font-mono">GOOGLE_CLIENT_SECRET</span> setzen.
        </p>
      )}
    </div>
  );
}
