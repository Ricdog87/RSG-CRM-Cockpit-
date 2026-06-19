"use client";

import { Component, type ReactNode } from "react";

/**
 * Granulare Client-Fehlergrenze: fängt Render-Fehler in ihrem Teilbaum ab,
 * damit ein einzelnes defektes Widget nicht die ganze Seite weiß-screent.
 * Zeigt die echte Fehlermeldung inline (clientseitig, nicht redigiert) –
 * so bleibt die Seite nutzbar und Fehler sind sichtbar.
 */
interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

export class SafeBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Hilft beim Debuggen in den Browser-/Server-Logs.
    console.error(`[SafeBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm">
          <p className="font-semibold text-ink">
            {this.props.label ? `${this.props.label}: ` : ""}Bereich konnte nicht geladen werden
          </p>
          <p className="mt-1 break-words text-xs text-muted">
            {this.state.error.message || "Unbekannter Fehler"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
