"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Mode = "magic" | "password";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/cockpit";

  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "Anmeldung fehlgeschlagen. Bitte erneut versuchen." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/cockpit/auth/callback?redirect=${encodeURIComponent(
              redirectTo
            )}`,
          },
        });
        if (error) throw error;
        setMessage(
          "Wir haben dir einen Anmelde-Link geschickt. Prüfe dein Postfach."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Etwas ist schiefgelaufen."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-sky";

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-base p-1">
          {(["magic", "password"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setMessage(null);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                mode === m
                  ? "bg-elevated text-ink"
                  : "text-faint hover:text-muted"
              )}
            >
              {m === "magic" ? "Magic Link" : "Passwort"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs text-muted">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@recruiting-sg.de"
              className={inputClass}
            />
          </div>

          {mode === "password" ? (
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs text-muted"
              >
                Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? "Einen Moment …"
              : mode === "magic"
                ? "Anmelde-Link senden"
                : "Anmelden"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
