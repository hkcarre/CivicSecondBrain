"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/db/supabase-browser";
import { StrataLogoMark } from "@/components/brand/StrataLogoMark";
import { cityToSlug } from "@/lib/city-slug";

/** Only allow same-origin path redirects ("/x" but not "//host" or "https://…"). */
function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

/** Supabase's rate-limit message reads "...you can only request this after 45 seconds." — pull the number out so the UI can show a countdown instead of raw error text. */
function parseRateLimitSeconds(message: string): number | null {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? parseInt(match[1], 10) : null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // city_slug rides along as auth user metadata so the on_auth_user_created
      // trigger can assign this signup to the RIGHT city — derived from this
      // deployment's own NEXT_PUBLIC_CITY_NAME/STATE env pair (same source
      // getCurrentCityId() uses server-side), not a URL param, so it can't be
      // spoofed by editing the address bar on a multi-city shared backend.
      const citySlug = cityToSlug(
        process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz",
        process.env.NEXT_PUBLIC_CITY_STATE ?? "TX"
      );

      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: { city_slug: citySlug },
        },
      });
      if (signInError) {
        const waitSeconds = parseRateLimitSeconds(signInError.message);
        if (waitSeconds !== null) {
          setCooldown(waitSeconds);
        } else {
          setError(signInError.message);
        }
      } else {
        setSent(true);
      }
    } catch (err) {
      // Surface the real error rather than a generic message — a thrown
      // error here (as opposed to a Supabase API error, handled above) is
      // usually a client misconfiguration, not an actual network failure,
      // and hiding the message makes that undiagnosable from the UI alone.
      setError((err as Error).message || "Network error — please try again.");
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Check <span className="font-medium">{email}</span> for a sign-in link.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          It&rsquo;ll expire shortly — request a new one if you don&rsquo;t click it in time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-city-navy"
          placeholder="you@schertz.gov"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {cooldown > 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          You just requested a link — for security, please wait {cooldown}s before requesting another.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || cooldown > 0}
        className="w-full py-2 px-4 bg-city-maroon text-white font-semibold rounded-lg
                   hover:opacity-90 disabled:opacity-50 transition-colors"
      >
        {cooldown > 0 ? `Wait ${cooldown}s…` : loading ? "Sending link…" : "Send sign-in link"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 w-fit">
            <StrataLogoMark variant="brand" size={40} className="dark:hidden" />
            <StrataLogoMark variant="reversed" size={40} className="hidden dark:block text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-city-navy dark:text-white">
            Strata Civic Solutions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz"}, {process.env.NEXT_PUBLIC_CITY_STATE ?? "TX"} · Sign in with email
          </p>
        </div>

        <Suspense fallback={<div className="h-32 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
          No password needed — we&rsquo;ll email you a one-time sign-in link.
        </p>
      </div>
    </div>
  );
}
