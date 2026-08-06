"use client";

/**
 * Magic-link landing target.
 *
 * With implicit auth flow (see supabase-browser.ts for why), Supabase
 * redirects here with the session tokens in the URL *fragment*
 * (#access_token=...) rather than a `?code=` query param a server route
 * would exchange. Fragments never reach the server, so establishing the
 * session has to happen client-side, in whichever browser actually opened
 * the link — that's the whole point: it no longer has to be the same
 * browser that requested it.
 */

import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/db/supabase-browser";

function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const settled = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    function goToNext() {
      if (settled.current) return;
      settled.current = true;
      router.replace(next);
    }

    function goToError() {
      if (settled.current) return;
      settled.current = true;
      router.replace("/login?error=auth_failed");
    }

    // An expired/already-used link comes back as
    // "#error=...&error_description=..." instead of tokens — no session is
    // ever coming, so don't wait on one.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get("error")) {
      goToError();
      return;
    }

    // detectSessionInUrl (default true) parses the fragment during client
    // construction above and fires this on success. Also check directly in
    // case that already resolved before this effect subscribed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goToNext();
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) goToNext();
    });

    // Neither the listener nor the direct check produced a session — the
    // link was invalid. Don't leave the user staring at "Signing you in…"
    // forever.
    const timeout = setTimeout(goToError, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [next, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}
