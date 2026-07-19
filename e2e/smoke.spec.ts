/**
 * e2e/smoke.spec.ts
 *
 * Minimal smoke suite exercising the full request path (build → server →
 * middleware → page render). Catches broken deployments — bad env vars,
 * broken API routes, Next.js config regressions — that unit tests miss.
 *
 * Deliberately NO AI-dependent assertions: these tests must pass without
 * ANTHROPIC_API_KEY, so nothing here sends a chat message or triggers
 * ingest/lint. See playwright.config.ts for the server env.
 */

import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("/ renders the chat UI shell", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();

    // "Ask the City" appears as an h1 twice on the empty-state page (page
    // header + SuggestedQuestions hero), so scope to the header landmark.
    await expect(
      page.locator("header").getByRole("heading", { name: "Ask the City" })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/Ask anything about/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send message" })
    ).toBeVisible();
  });

  test("/wiki renders the wiki index", async ({ page }) => {
    const response = await page.goto("/wiki");
    expect(response?.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", { name: "Wiki", exact: true })
    ).toBeVisible();
    // Renders either the empty state (seed wiki) or category sections —
    // the subtitle paragraph is present in both cases.
    await expect(
      page.getByText(/No pages yet|page(s)? across/)
    ).toBeVisible();
  });

  test("/dashboard renders stats and headings", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", { name: "City Health" })
    ).toBeVisible();
    await expect(page.getByText("Documents Ingested")).toBeVisible();
    await expect(page.getByText("Wiki Pages", { exact: true })).toBeVisible();
    await expect(page.getByText("Decisions Logged")).toBeVisible();
  });

  test("GET /api/health/live returns 200 alive", async ({ request }) => {
    const response = await request.get("/api/health/live");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "alive" });
  });

  test("/admin is auth-gated — redirects to the login page", async ({
    page,
  }) => {
    const response = await page.goto("/admin");
    expect(response?.ok()).toBeTruthy();

    // ADMIN_PASSWORD is set by the e2e webServer config, so the middleware
    // redirects unauthenticated requests to /admin/login.
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(
      page.getByRole("heading", { name: "Admin Access" })
    ).toBeVisible();
    await expect(page.getByLabel("Admin Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
