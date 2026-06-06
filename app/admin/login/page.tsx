"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push(next);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Invalid password");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Admin Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-city-navy"
          placeholder="Enter admin password"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-city-navy text-white font-semibold rounded-lg
                   hover:bg-city-navy/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-city-navy dark:text-white">Admin Access</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            CivicSecondBrain · Schertz, TX
          </p>
        </div>

        <Suspense fallback={<div className="h-32 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
          Set <code className="font-mono">ADMIN_PASSWORD</code> in Railway env vars.
          <br />
          If unset, admin is open (dev mode only).
        </p>
      </div>
    </div>
  );
}
