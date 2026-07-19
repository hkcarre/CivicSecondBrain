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

// ─── Export route auth ──────────────────────────────────────────────────────

const SESSION_COOKIE = "admin_session";

/**
 * Derive the expected admin session token from the admin password.
 * Must stay in sync with middleware.ts and /api/admin/login:
 * HMAC-SHA256(key = ADMIN_PASSWORD, message = "civic-admin"), hex-encoded.
 */
async function deriveAdminToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("civic-admin"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

/**
 * Shared dual-auth check: accepts EITHER
 *  - a valid `admin_session` cookie (set by POST /api/admin/login — browser
 *    requests from the admin panel work without changes), OR
 *  - an `Authorization: Bearer <INGEST_SECRET>` header (for scripts/cron).
 *
 * If neither ADMIN_PASSWORD nor INGEST_SECRET is configured, returns true
 * (dev/local mode) but logs a warning — consistent with verifySecret above.
 */
async function verifyAdminOrSecret(req: Request, routeLabel: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const ingestSecret = process.env.INGEST_SECRET;

  if (!adminPassword && !ingestSecret) {
    console.warn(
      "[auth] WARNING: Neither ADMIN_PASSWORD nor INGEST_SECRET is set. " +
        `All requests to ${routeLabel} are accepted in dev mode. ` +
        "Set them in production to restrict access."
    );
    return true;
  }

  if (adminPassword) {
    const sessionCookie = getCookie(req, SESSION_COOKIE);
    if (sessionCookie && sessionCookie === (await deriveAdminToken(adminPassword))) {
      return true;
    }
  }

  if (ingestSecret) {
    const [scheme, token] = (req.headers.get("authorization") ?? "").split(" ");
    if (scheme === "Bearer" && token === ingestSecret) {
      return true;
    }
  }

  return false;
}

/**
 * Verifies access to the /api/export/* routes (admin cookie OR bearer secret).
 */
export async function verifyExportAccess(req: Request): Promise<boolean> {
  return verifyAdminOrSecret(req, "/api/export/*");
}

/**
 * Verifies access to the ingest-family mutation routes: /api/ingest,
 * /api/ingest/document, /api/ingest/upload, /api/lint, and /api/briefing.
 *
 * Accepts the admin session cookie so the password-protected admin panel's
 * buttons work in production, OR the bearer secret for scripted/cron callers.
 * (Previously these routes accepted only the bearer secret, so every admin
 * panel action returned 401 on deployments with INGEST_SECRET set.)
 */
export async function verifyIngestAccess(req: Request): Promise<boolean> {
  return verifyAdminOrSecret(req, "/api/ingest, /api/lint, and /api/briefing");
}
