import { Building2, Users, MessageSquare, Database, ExternalLink } from "lucide-react";
import {
  listMunicipalities,
  listUsers,
  getUsageByCity,
  type MunicipalitySummary,
  type UserSummary,
  type UsagePoint,
} from "@/lib/db/queries/console";
import { UsageByCityChart } from "@/components/charts/UsageByCityChart";

export const revalidate = 60;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * This page is statically prerendered at build time (revalidate = 60, same
 * ISR pattern as /dashboard) — Railway's Docker build stage doesn't have
 * real Supabase access, only the running container does, so a missing/
 * misconfigured env var during the build must degrade gracefully rather
 * than crash the whole build. Runtime requests after the first successful
 * revalidation get real data; mirrors app/dashboard/page.tsx's
 * getFinancialTrendsData() try/catch for the exact same reason.
 */
async function getConsoleData(): Promise<{
  municipalities: MunicipalitySummary[];
  users: UserSummary[];
  usagePoints: UsagePoint[];
}> {
  try {
    const [municipalities, users, usagePoints] = await Promise.all([
      listMunicipalities(),
      listUsers(),
      getUsageByCity(30),
    ]);
    return { municipalities, users, usagePoints };
  } catch (err) {
    console.warn("[console] Data unavailable:", (err as Error).message);
    return { municipalities: [], users: [], usagePoints: [] };
  }
}

export default async function ConsolePage() {
  const { municipalities, users, usagePoints } = await getConsoleData();

  const totalUsers = municipalities.reduce((sum, m) => sum + m.userCount, 0);
  const totalMessages = municipalities.reduce((sum, m) => sum + m.messageCount, 0);
  const totalFacts = municipalities.reduce((sum, m) => sum + m.factCount, 0);

  const usageByCity = Array.from(
    usagePoints.reduce((map, p) => {
      map.set(p.cityName, (map.get(p.cityName) ?? 0) + p.messageCount);
      return map;
    }, new Map<string, number>())
  ).map(([cityName, messageCount]) => ({ cityName, messageCount }));

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-city-navy dark:text-city-maroon">Strata Console</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Cross-city view — municipalities, users, and usage</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard icon={Building2} label="Municipalities" value={municipalities.length} />
        <StatCard icon={Users} label="Total Users" value={totalUsers} />
        <StatCard icon={MessageSquare} label="Total Messages" value={totalMessages} />
        <StatCard icon={Database} label="Facts Extracted" value={totalFacts} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">Messages by municipality</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Last 30 days, all cities</p>
        <UsageByCityChart data={usageByCity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm px-4 pt-4 pb-3">Municipalities</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Users</th>
                  <th className="px-4 py-2 font-medium">Chats</th>
                  <th className="px-4 py-2 font-medium">Facts</th>
                  <th className="px-4 py-2 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {municipalities.map((m) => (
                  <tr key={m.cityId} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">
                      {m.deploymentUrl ? (
                        <a
                          href={m.deploymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-city-maroon transition-colors"
                        >
                          {m.name}, {m.state}
                          <ExternalLink size={11} className="text-gray-400" />
                        </a>
                      ) : (
                        <span title="Not deployed yet">
                          {m.name}, {m.state}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 tabular-nums">{m.userCount}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 tabular-nums">{m.conversationCount}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 tabular-nums">{m.factCount}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{formatDate(m.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm px-4 pt-4 pb-3">Users</h2>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Messages</th>
                  <th className="px-4 py-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500 text-xs">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.userId} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{u.email}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{u.cityName}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{u.role}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 tabular-nums">{u.messageCount}</td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{formatDate(u.lastActive)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex items-center gap-1.5 text-city-navy dark:text-city-maroon mb-1">
        <Icon size={14} />
      </div>
      <p className="text-2xl font-bold text-city-navy dark:text-city-maroon">{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
