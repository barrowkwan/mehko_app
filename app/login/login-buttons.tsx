"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALL_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "facebook", label: "Continue with Facebook" },
  { id: "github", label: "Continue with GitHub" },
  { id: "apple", label: "Continue with Apple" },
] as const;

// Only show providers that are configured in Supabase (see docs/social-login-setup.md).
const ENABLED = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "google,facebook,apple").split(",").map((s) => s.trim());
const PROVIDERS = ALL_PROVIDERS.filter((p) => ENABLED.includes(p.id));

export function LoginButtons({ next }: { next: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: (typeof ALL_PROVIDERS)[number]["id"]) {
    setBusy(provider);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => signIn(p.id)}
          disabled={busy !== null}
          className="rounded-lg border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {busy === p.id ? "Redirecting…" : p.label}
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
