import { HealthCard } from "../components/dashboard/HealthCard";
import { WikiHealthPanel } from "../components/dashboard/WikiHealthPanel";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { RunAnalysisButton } from "../components/dashboard/RunAnalysisButton";
import { getDashboardData } from "../lib/wiki/dashboard-data";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function DashboardPage() {
  const { recommendations, healthReport, recentLog, stats } =
    await getDashboardData();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-city-navy dark:text-city-gold">City Health</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            AI-generated analysis from{" "}
            <span className="font-medium">{stats.sourcesIngested}</span> city
            documents ·{" "}
            <span className="font-medium">{stats.wikiPages}</span> wiki pages
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Documents Ingested" value={stats.sourcesIngested} />
          <StatCard label="Wiki Pages" value={stats.wikiPages} />
          <StatCard label="Decisions Logged" value={stats.decisionsLogged} />
          <StatCard label="AI Recommendations" value={recommendations.length} />
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Recommendations — 2/3 width */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                AI Recommendations
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ⚠️ All items require council review
                </span>
                <RunAnalysisButton />
              </div>
            </div>

            {recommendations.length === 0 ? (
              <EmptyRecommendations />
            ) : (
              recommendations.map((rec) => (
                <HealthCard
                  key={rec.id}
                  severity={rec.severity}
                  title={rec.title}
                  finding={rec.finding}
                  suggestedAction={rec.suggestedAction}
                  generatedAt={rec.generatedAt}
                  path={rec.path}
                />
              ))
            )}
          </div>

          {/* Right column — 1/3 width */}
          <div className="space-y-4">
            <WikiHealthPanel report={healthReport} />
            <RecentActivity entries={recentLog} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
      <p className="text-2xl font-bold text-city-navy dark:text-city-gold">{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function EmptyRecommendations() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
      <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">No recommendations yet.</p>
      <p className="text-gray-400 dark:text-gray-500 text-xs">
        Run{" "}
        <code className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
          npm run lint:wiki
        </code>{" "}
        to generate the first analysis, or wait for the nightly job at 2:00 AM CT.
      </p>
    </div>
  );
}
