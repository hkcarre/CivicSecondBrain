import { describe, expect, it } from "vitest";
import { buildManualIngestPayload } from "@/components/admin/AdminIngestPanel";

describe("buildManualIngestPayload", () => {
  it("trims fields and omits empty optional values", () => {
    expect(
      buildManualIngestPayload({
        url: " https://example.com/doc.pdf ",
        title: "  Public Notice  ",
        type: "",
        board: "  ",
        date: "",
      })
    ).toEqual({
      url: "https://example.com/doc.pdf",
      title: "Public Notice",
    });
  });

  it("includes optional manual ingest metadata when provided", () => {
    expect(
      buildManualIngestPayload({
        url: "https://example.com/agenda.pdf",
        title: "Council Agenda",
        type: "agenda",
        board: "city-council",
        date: "2026-06-20",
      })
    ).toEqual({
      url: "https://example.com/agenda.pdf",
      title: "Council Agenda",
      type: "agenda",
      board: "city-council",
      date: "2026-06-20",
    });
  });
});
