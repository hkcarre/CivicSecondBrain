/**
 * env-config.test.ts
 *
 * Tests for app/lib/env.ts: deprecated env var fallbacks with one-time
 * warnings (issue #135) and city identity consolidation where server-side
 * reads fall back to the NEXT_PUBLIC_ pair (issue #141).
 *
 * Uses vi.resetModules() + dynamic import so the module-level "warn once"
 * state is isolated per test (see existing tests for the pattern).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ENV_VARS = [
  "CIVICPLUS_URL",
  "SCHERTZ_GOV_URL",
  "LASERFICHE_URL",
  "SCHERTZ_LASERFICHE_URL",
  "CITY_NAME",
  "CITY_STATE",
  "NEXT_PUBLIC_CITY_NAME",
  "NEXT_PUBLIC_CITY_STATE",
];

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  for (const name of ENV_VARS) delete process.env[name];
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const name of ENV_VARS) delete process.env[name];
  warnSpy.mockRestore();
});

async function loadEnv() {
  return await import("@/lib/env");
}

describe("envWithDeprecatedFallback", () => {
  it("returns the canonical var when set, without warning", async () => {
    process.env.CIVICPLUS_URL = "https://www.newbraunfels.gov/1/Government";
    const { envWithDeprecatedFallback } = await loadEnv();
    expect(envWithDeprecatedFallback("CIVICPLUS_URL", "SCHERTZ_GOV_URL")).toBe(
      "https://www.newbraunfels.gov/1/Government"
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("prefers the canonical var over the deprecated one", async () => {
    process.env.CIVICPLUS_URL = "https://new.example.com/1/Government";
    process.env.SCHERTZ_GOV_URL = "https://old.example.com/27/Government";
    const { envWithDeprecatedFallback } = await loadEnv();
    expect(envWithDeprecatedFallback("CIVICPLUS_URL", "SCHERTZ_GOV_URL")).toBe(
      "https://new.example.com/1/Government"
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to the deprecated var with a deprecation warning", async () => {
    process.env.SCHERTZ_GOV_URL = "https://www.schertz.com/27/Government";
    const { envWithDeprecatedFallback } = await loadEnv();
    expect(envWithDeprecatedFallback("CIVICPLUS_URL", "SCHERTZ_GOV_URL")).toBe(
      "https://www.schertz.com/27/Government"
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("SCHERTZ_GOV_URL is deprecated");
    expect(String(warnSpy.mock.calls[0][0])).toContain("CIVICPLUS_URL");
  });

  it("warns only once per deprecated var across repeated reads", async () => {
    process.env.SCHERTZ_LASERFICHE_URL = "https://laserfiche.schertzweb.com";
    const { envWithDeprecatedFallback } = await loadEnv();
    envWithDeprecatedFallback("LASERFICHE_URL", "SCHERTZ_LASERFICHE_URL");
    envWithDeprecatedFallback("LASERFICHE_URL", "SCHERTZ_LASERFICHE_URL");
    envWithDeprecatedFallback("LASERFICHE_URL", "SCHERTZ_LASERFICHE_URL");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when neither var is set", async () => {
    const { envWithDeprecatedFallback } = await loadEnv();
    expect(envWithDeprecatedFallback("CIVICPLUS_URL", "SCHERTZ_GOV_URL")).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("treats empty strings as unset (.env.example ships empty placeholders)", async () => {
    process.env.CIVICPLUS_URL = "";
    process.env.SCHERTZ_GOV_URL = "https://www.schertz.com/27/Government";
    const { envWithDeprecatedFallback } = await loadEnv();
    expect(envWithDeprecatedFallback("CIVICPLUS_URL", "SCHERTZ_GOV_URL")).toBe(
      "https://www.schertz.com/27/Government"
    );
  });
});

describe("getCityName / getCityState", () => {
  it("defaults to Schertz, TX when nothing is set", async () => {
    const { getCityName, getCityState, getCityFull } = await loadEnv();
    expect(getCityName()).toBe("Schertz");
    expect(getCityState()).toBe("TX");
    expect(getCityFull()).toBe("Schertz, TX");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to the NEXT_PUBLIC_ pair so operators only set one pair", async () => {
    process.env.NEXT_PUBLIC_CITY_NAME = "New Braunfels";
    process.env.NEXT_PUBLIC_CITY_STATE = "TX";
    const { getCityFull } = await loadEnv();
    expect(getCityFull()).toBe("New Braunfels, TX");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("lets CITY_NAME / CITY_STATE override server-side (backward compat)", async () => {
    process.env.CITY_NAME = "Cibolo";
    process.env.CITY_STATE = "TX";
    const { getCityName, getCityState } = await loadEnv();
    expect(getCityName()).toBe("Cibolo");
    expect(getCityState()).toBe("TX");
  });

  it("warns once when the server and NEXT_PUBLIC_ values diverge", async () => {
    process.env.CITY_NAME = "Cibolo";
    process.env.NEXT_PUBLIC_CITY_NAME = "Schertz";
    const { getCityName } = await loadEnv();
    expect(getCityName()).toBe("Cibolo"); // server-side override still wins
    getCityName();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("CITY_NAME");
    expect(String(warnSpy.mock.calls[0][0])).toContain("NEXT_PUBLIC_CITY_NAME");
  });

  it("does not warn when both pairs match", async () => {
    process.env.CITY_NAME = "Schertz";
    process.env.NEXT_PUBLIC_CITY_NAME = "Schertz";
    const { getCityName } = await loadEnv();
    expect(getCityName()).toBe("Schertz");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
