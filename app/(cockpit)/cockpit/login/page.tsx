import { Suspense } from "react";
import { LoginForm } from "@/components/cockpit/LoginForm";

export const metadata = {
  title: "Anmeldung · RSG Partner-Cockpit",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-cyan text-lg font-black text-white shadow-glow">
            RSG
          </div>
          <h1 className="text-xl font-bold text-ink">Partner-Cockpit</h1>
          <p className="mt-1 text-sm text-muted">
            Melde dich an, um deinen Bestand zu sehen.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
