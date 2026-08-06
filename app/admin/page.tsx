import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getAdminData } from "../lib/wiki/admin-data";
import { listPendingReviews } from "../lib/wiki/pending-review";
import { listFlaggedFacts } from "../lib/db/facts";
import { getCurrentCityId } from "../lib/db/cities";
import { AdminIngestPanel } from "../components/admin/AdminIngestPanel";
import { ManifestTable } from "../components/admin/ManifestTable";
import { AdminLogoutButton } from "../components/admin/AdminLogoutButton";

// Was `revalidate = 60` — up to 60s stale is exactly what just caused a
// confusing mismatch: this page's badge count updated on its own cadence
// while /admin/review (frozen at build time — see that page's own comment)
// showed something completely different. Always rendering fresh here too
// means the badge and the page it links to can never disagree again.
export const dynamic = "force-dynamic";

/** See app/admin/review/page.tsx's loadFlaggedFacts — same fail-silently pattern. */
async function countFlaggedFacts(): Promise<number> {
  try {
    const cityId = await getCurrentCityId();
    return (await listFlaggedFacts(cityId)).length;
  } catch {
    return 0;
  }
}

export default async function AdminPage() {
  const { manifest, wikiStats, logSummary, schedule } = await getAdminData();
  const [wikiPendingCount, flaggedFactsCount] = await Promise.all([
    Promise.resolve(listPendingReviews().length),
    countFlaggedFacts(),
  ]);
  const pendingCount = wikiPendingCount + flaggedFactsCount;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-city-navy">Admin</h1>
            <p className="text-sm text-gray-400 mt-1">
              Knowledge base management · Document ingestion · Wiki health
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/review"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all"
            >
              <ClipboardList size={14} />
              Pending Review
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-city-maroon text-white text-[11px] font-semibold">
                  {pendingCount}
                </span>
              )}
            </Link>
            {process.env.ADMIN_PASSWORD && <AdminLogoutButton />}
          </div>
        </div>

        {/* Main grid — stacked on mobile, 3-col on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: ingest panel + stats */}
          <div className="lg:col-span-1 space-y-4">
            <AdminIngestPanel stats={wikiStats} logSummary={logSummary} schedule={schedule} />
          </div>

          {/* Right: manifest table */}
          <div className="lg:col-span-2 min-w-0">
            <ManifestTable documents={manifest} />
          </div>
        </div>
      </div>
    </div>
  );
}
