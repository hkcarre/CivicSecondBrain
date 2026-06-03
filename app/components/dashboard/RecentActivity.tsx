import { FileText, RefreshCw, Zap, Search } from "lucide-react";

interface LogEntry {
  date: string;
  operation: string;
  label: string;
}

interface RecentActivityProps {
  entries: LogEntry[];
}

const OP_ICONS: Record<string, React.ElementType> = {
  INGEST: FileText,
  "INGEST-BATCH": RefreshCw,
  LINT: Zap,
  QUERY: Search,
  BOOTSTRAP: RefreshCw,
  RECOMMEND: Zap,
};

const OP_COLORS: Record<string, string> = {
  INGEST: "bg-blue-100 text-blue-700",
  "INGEST-BATCH": "bg-indigo-100 text-indigo-700",
  LINT: "bg-purple-100 text-purple-700",
  QUERY: "bg-gray-100 text-gray-600",
  BOOTSTRAP: "bg-green-100 text-green-700",
  RECOMMEND: "bg-amber-100 text-amber-700",
};

export function RecentActivity({ entries }: RecentActivityProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">
          No activity yet. Run{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">
            npm run ingest:seed
          </code>{" "}
          to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => {
            const Icon = OP_ICONS[entry.operation] ?? FileText;
            const colorClass = OP_COLORS[entry.operation] ?? "bg-gray-100 text-gray-600";

            return (
              <div key={i} className="flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                >
                  <Icon size={13} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">
                      {entry.operation}
                    </span>
                    <span className="text-xs text-gray-400">{entry.date}</span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{entry.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
