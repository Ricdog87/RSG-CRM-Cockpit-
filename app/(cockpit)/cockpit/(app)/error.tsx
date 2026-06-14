"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/** Fehlerzustand (z.B. kein Partner-Profil zur Session) – als Handlungsaufforderung. */
export default function CockpitError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md">
        <CardBody className="space-y-4 text-center">
          <h1 className="text-lg font-bold text-ink">
            Cockpit konnte nicht geladen werden
          </h1>
          <p className="text-sm text-muted">
            {error.message ||
              "Es gab ein Problem beim Laden deiner Daten. Bitte versuche es erneut."}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="primary" onClick={reset}>
              Erneut versuchen
            </Button>
            <form action="/cockpit/auth/signout" method="post">
              <Button variant="ghost" type="submit">
                Abmelden
              </Button>
            </form>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
