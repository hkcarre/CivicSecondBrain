/**
 * POST /api/briefing
 *
 * Generates a pre-meeting briefing packet from a published agenda URL:
 * downloads + parses the agenda, extracts the item list with one AI call,
 * cross-references each item against the wiki, and writes one packet page
 * to wiki/briefings/.
 *
 * Body: { agendaUrl: string, meetingDate?: "YYYY-MM-DD", board?: string }
 * Auth: Authorization: Bearer <INGEST_SECRET> (same as /api/ingest, /api/lint)
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifySecret } from "@/lib/auth";
import { generateBriefing } from "@/lib/briefing/generate";
import {
  BriefingGenerationError,
  BriefingValidationError,
  parseBriefingInput,
} from "@/lib/briefing/helpers";

export const maxDuration = 300; // 5 minutes — up to 26 AI calls per packet

export async function POST(req: Request): Promise<NextResponse> {
  if (!verifySecret(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const input = parseBriefingInput(body);
    const result = await generateBriefing(input);

    // Bust the dashboard ISR cache so the new packet appears immediately
    revalidatePath("/dashboard");

    return NextResponse.json({
      success: true,
      message: `Briefing packet generated: ${result.itemCount} agenda item${result.itemCount !== 1 ? "s" : ""} briefed${result.truncated ? ` (of ${result.totalItems} — capped)` : ""}.`,
      ...result,
    });
  } catch (err) {
    if (err instanceof BriefingValidationError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: 400 }
      );
    }

    if (err instanceof BriefingGenerationError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }

    console.error("BRIEFING error:", err);
    return NextResponse.json(
      { success: false, message: `Error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
