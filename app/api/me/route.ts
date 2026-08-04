/**
 * GET /api/me
 *
 * Lightweight endpoint for client components that need to know the current
 * user's permission level without forcing a server-rendered page to become
 * fully dynamic. Currently just exposes is_strata_admin (for the Sidebar's
 * conditional Console nav link) — expand here rather than adding new
 * one-off endpoints if more client-side permission checks show up.
 */

import { NextResponse } from "next/server";
import { currentUserIsStrataAdmin } from "@/lib/db/queries/console";

export async function GET() {
  const isStrataAdmin = await currentUserIsStrataAdmin();
  return NextResponse.json({ isStrataAdmin });
}
