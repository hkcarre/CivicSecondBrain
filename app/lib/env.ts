/**
 * Centralized environment variable helpers.
 *
 * Two concerns live here:
 *
 * 1. Deprecated env var renames (issue #135): `envWithDeprecatedFallback()`
 *    reads the canonical name first and falls back to the old name with a
 *    one-time deprecation warning, so existing deployments keep working.
 *
 * 2. City identity consolidation (issue #141): server-side reads fall back
 *    to the NEXT_PUBLIC_* variants, so operators only need to set the
 *    NEXT_PUBLIC_ pair. The non-prefixed CITY_NAME / CITY_STATE still work
 *    as server-side overrides for backward compatibility, and a warning is
 *    logged when the two pairs are set to different values.
 */

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/**
 * Read an env var by name at runtime.
 *
 * Computed (bracket) access is deliberate: Next.js statically inlines
 * `process.env.NEXT_PUBLIC_*` member expressions at build time (Docker builds
 * may not have the values set), but server code and CLI scripts should honor
 * the runtime environment. Empty strings are treated as unset because
 * `.env.example` ships empty placeholders (e.g. `GOV_BASE_URL=`).
 */
function read(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

/**
 * Read `canonicalName`, falling back to the deprecated `deprecatedName` with
 * a one-time console.warn. Returns undefined when neither is set.
 */
export function envWithDeprecatedFallback(
  canonicalName: string,
  deprecatedName: string
): string | undefined {
  const canonical = read(canonicalName);
  if (canonical !== undefined) return canonical;

  const legacy = read(deprecatedName);
  if (legacy !== undefined) {
    warnOnce(
      `deprecated:${deprecatedName}`,
      `[deprecation] ${deprecatedName} is deprecated — rename it to ${canonicalName}. ` +
        `The old name still works for now but will be removed in a future major release.`
    );
  }
  return legacy;
}

/** Warn (once per pair) when the server-side and NEXT_PUBLIC_ city vars diverge. */
function warnOnCityMismatch(serverVar: string, clientVar: string): void {
  const serverValue = read(serverVar);
  const clientValue = read(clientVar);
  if (serverValue !== undefined && clientValue !== undefined && serverValue !== clientValue) {
    warnOnce(
      `mismatch:${serverVar}`,
      `[config] ${serverVar} ("${serverValue}") and ${clientVar} ("${clientValue}") differ — ` +
        `AI prompts will use "${serverValue}" while the UI shows "${clientValue}". ` +
        `Set only the NEXT_PUBLIC_ pair (recommended) or make both pairs match.`
    );
  }
}

/** City name for server-side use (AI prompts, scraper logs). */
export function getCityName(): string {
  warnOnCityMismatch("CITY_NAME", "NEXT_PUBLIC_CITY_NAME");
  return read("CITY_NAME") ?? read("NEXT_PUBLIC_CITY_NAME") ?? "Schertz";
}

/** Two-letter state abbreviation for server-side use. */
export function getCityState(): string {
  warnOnCityMismatch("CITY_STATE", "NEXT_PUBLIC_CITY_STATE");
  return read("CITY_STATE") ?? read("NEXT_PUBLIC_CITY_STATE") ?? "TX";
}

/** "City, ST" — convenience for prompt templates. */
export function getCityFull(): string {
  return `${getCityName()}, ${getCityState()}`;
}
