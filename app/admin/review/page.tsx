import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listPendingReviews } from "@/lib/wiki/pending-review";
import { listFlaggedFacts, type FlaggedFact } from "@/lib/db/facts";
import { getCurrentCityId } from "@/lib/db/cities";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { FactsReviewQueue } from "@/components/admin/FactsReviewQueue";

// Neither listPendingReviews() (plain fs.readFileSync) nor listFlaggedFacts()
// (a Supabase client call) uses a Next-recognized dynamic API, so without
// this Next had no signal that this page needs to re-render per request —
// it silently prerendered the review queue ONCE at build time (always
// empty then) and served that frozen snapshot forever after. A queue of
// actions waiting on a human is exactly the page that must never be stale.
export const dynamic = "force-dynamic";

/**
 * Facts review is a separately-configured layer (Supabase) on top of the
 * file-based wiki review queue — a deployment without it set up, or a city
 * with nothing flagged, should still show the wiki queue normally. Mirrors
 * buildStructuredFactsBlock's fail-silently pattern in app/api/chat/route.ts.
 */
async function loadFlaggedFacts(): Promise<FlaggedFact[]> {
  try {
    const cityId = await getCurrentCityId();
    return await listFlaggedFacts(cityId);
  } catch (err) {
    console.warn("[admin/review] Flagged facts unavailable:", (err as Error).message);
    return [];
  }
}

export default async function ReviewPage() {
  const [items, flaggedFacts] = await Promise.all([
    Promise.resolve(listPendingReviews()),
    loadFlaggedFacts(),
  ]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-city-navy mb-3"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-city-navy">Pending Review</h1>
          <p className="text-sm text-gray-400 mt-1">
            AI-generated wiki content and council recommendations wait here until approved — nothing below is visible to chat or the dashboard yet.
          </p>
        </div>

        <ReviewQueue initialItems={items} />

        <div className="mt-10 mb-6">
          <h2 className="text-lg font-bold text-city-navy">Flagged Numeric Facts</h2>
          <p className="text-sm text-gray-400 mt-1">
            Low-confidence or conflicting figures held back from chat and the dashboard until a reviewer approves or rejects them.
          </p>
        </div>
        <FactsReviewQueue initialItems={flaggedFacts} />
      </div>
    </div>
  );
}
