import { getAdminData } from "../lib/wiki/admin-data";
import { AdminIngestPanel } from "../components/admin/AdminIngestPanel";
import { ManifestTable } from "../components/admin/ManifestTable";
import { AdminLogoutButton } from "../components/admin/AdminLogoutButton";

export const revalidate = 60;

export default async function AdminPage() {
  const { manifest, wikiStats, logSummary } = await getAdminData();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-city-navy">Admin</h1>
            <p className="text-sm text-gray-400 mt-1">
              Knowledge base management · Document ingestion · Wiki health
            </p>
          </div>
          {process.env.ADMIN_PASSWORD && <AdminLogoutButton />}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Left: ingest panel + stats */}
          <div className="col-span-1 space-y-4">
            <AdminIngestPanel stats={wikiStats} logSummary={logSummary} />
          </div>

          {/* Right: manifest table */}
          <div className="col-span-2">
            <ManifestTable documents={manifest} />
          </div>
        </div>
      </div>
    </div>
  );
}
