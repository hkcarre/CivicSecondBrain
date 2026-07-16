export const runtime = "nodejs";

/**
 * Liveness probe — always returns 200 if the process is running.
 * Used by Railway healthcheck so deployment succeeds regardless of
 * API key / wiki state. Use /api/health for full readiness status.
 */
export function GET() {
  return Response.json({ status: "alive" }, { status: 200 });
}
