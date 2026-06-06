/**
 * Shared-secret authentication helper for internal API routes.
 *
 * Usage:
 *   import { verifySecret } from "@/lib/auth";
 *   if (!verifySecret(req)) return new Response("Unauthorized", { status: 401 });
 */

/**
 * Verifies that the incoming request carries a valid INGEST_SECRET token.
 *
 * Rules:
 *  - If INGEST_SECRET is not configured, returns true (dev/local mode) but logs a warning.
 *  - If INGEST_SECRET is configured, the request must include an
 *    `Authorization: Bearer <secret>` header whose value matches exactly.
 */
export function verifySecret(req: Request): boolean {
  const secret = process.env.INGEST_SECRET;

  if (!secret) {
    console.warn(
      "[auth] WARNING: INGEST_SECRET is not set. " +
        "All requests to /api/ingest and /api/lint are accepted in dev mode. " +
        "Set INGEST_SECRET in production to restrict access."
    );
    return true;
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || token !== secret) {
    return false;
  }

  return true;
}
