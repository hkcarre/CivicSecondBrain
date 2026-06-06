import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifySecret } from "../lib/auth";

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["authorization"] = authHeader;
  }
  return new Request("https://example.com/api/ingest", {
    method: "POST",
    headers,
  });
}

describe("verifySecret", () => {
  const originalSecret = process.env.INGEST_SECRET;

  beforeEach(() => {
    delete process.env.INGEST_SECRET;
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env["INGEST_SECRET"] = originalSecret;
    } else {
      delete process.env.INGEST_SECRET;
    }
  });

  describe("when INGEST_SECRET is not set (dev mode)", () => {
    it("returns true regardless of authorization header", () => {
      expect(verifySecret(makeRequest())).toBe(true);
      expect(verifySecret(makeRequest("Bearer anything"))).toBe(true);
      expect(verifySecret(makeRequest("Bearer "))).toBe(true);
    });
  });

  describe("when INGEST_SECRET is configured", () => {
    const secret = "super-secret-token-abc123";

    beforeEach(() => {
      process.env["INGEST_SECRET"] = secret;
    });

    it("returns true with correct Bearer token", () => {
      expect(verifySecret(makeRequest(`Bearer ${secret}`))).toBe(true);
    });

    it("returns false when authorization header is absent", () => {
      expect(verifySecret(makeRequest())).toBe(false);
    });

    it("returns false with wrong token", () => {
      expect(verifySecret(makeRequest("Bearer wrong-token"))).toBe(false);
    });

    it("returns false with correct token but wrong scheme", () => {
      expect(verifySecret(makeRequest(`Basic ${secret}`))).toBe(false);
      expect(verifySecret(makeRequest(`Token ${secret}`))).toBe(false);
    });

    it("returns false with empty authorization header", () => {
      expect(verifySecret(makeRequest(""))).toBe(false);
    });

    it("is case-sensitive for the token", () => {
      expect(verifySecret(makeRequest(`Bearer ${secret.toUpperCase()}`))).toBe(false);
    });
  });
});
