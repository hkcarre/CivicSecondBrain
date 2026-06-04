import Link from "next/link";
import { readWikiIndex } from "../lib/wiki/reader";
import type { WikiCategory, WikiIndexEntry } from "../types";

export const revalidate = 300;

const CATEGORY_META: Record<
  WikiCategory,
  { label: string; color: string; description: string }
> = {
  topic: {
    label: "Topics",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    description: "City policy areas, departments, and civic subjects",
  },
  decision: {
    label: "Decisions",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Council votes, ordinances, and resolutions",
  },
  person: {
    label: "People",
    color: "bg-green-50 text-green-700 border-green-200",
    description: "Council members, staff, and key officials",
  },
  recommendation: {
    label: "Recommendations",
    color: "bg-red-50 text-red-700 border-red-200",
    description: "AI-generated analysis — requires council review",
  },
  query: {
    label: "Saved Queries",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    description: "Previously answered questions",
  },
};

const CATEGORY_ORDER: WikiCategory[] = [
  "topic",
  "decision",
  "person",
  "recommendation",
  "query",
];

export default function WikiPage() {
  const seen = new Set<string>();
  const entries = readWikiIndex().filter((e) => {
    if (seen.has(e.path)) return false;
    seen.add(e.path);
    return true;
  });

  const grouped = CATEGORY_ORDER.reduce<Record<WikiCategory, WikiIndexEntry[]>>(
    (acc, cat) => {
      acc[cat] = entries.filter((e) => e.category === cat);
      return acc;
    },
    {} as Record<WikiCategory, WikiIndexEntry[]>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-city-navy">Wiki</h1>
          <p className="text-sm text-gray-400 mt-1">
            {entries.length === 0
              ? "No pages yet — run npm run ingest:seed to populate"
              : `${entries.length} page${entries.length !== 1 ? "s" : ""} across ${
                  CATEGORY_ORDER.filter((c) => grouped[c].length > 0).length
                } categories`}
          </p>
        </div>

        {entries.length === 0 ? (
          <EmptyWiki />
        ) : (
          <div className="space-y-8">
            {CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0).map(
              (cat) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  entries={grouped[cat]}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategorySection({
  category,
  entries,
}: {
  category: WikiCategory;
  entries: WikiIndexEntry[];
}) {
  const meta = CATEGORY_META[category];
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold text-gray-900">{meta.label}</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${meta.color}`}
        >
          {entries.length}
        </span>
        <span className="text-xs text-gray-400">{meta.description}</span>
      </div>
      <div className="grid gap-2">
        {entries.map((entry) => (
          <WikiEntryRow key={entry.path} entry={entry} category={category} />
        ))}
      </div>
    </section>
  );
}

function WikiEntryRow({
  entry,
  category,
}: {
  entry: WikiIndexEntry;
  category: WikiCategory;
}) {
  const meta = CATEGORY_META[category];
  const title = entry.path
    .replace(/^(topics|decisions|people|recommendations|queries)\//, "")
    .replace(/\.md$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Link
      href={`/wiki/${encodeURIComponent(entry.path.replace(/\.md$/, ""))}`}
      className="flex items-start justify-between gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-city-navy hover:shadow-sm transition-all group"
    >
      <div className="min-w-0">
        <p className="font-medium text-gray-900 group-hover:text-city-navy truncate">
          {title}
        </p>
        {entry.summary && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
            {entry.summary}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
        {entry.sourceCount > 0 && (
          <span
            className={`px-2 py-0.5 rounded-full border ${meta.color} whitespace-nowrap`}
          >
            {entry.sourceCount} source{entry.sourceCount !== 1 ? "s" : ""}
          </span>
        )}
        {entry.lastUpdated && <span>{entry.lastUpdated}</span>}
      </div>
    </Link>
  );
}

function EmptyWiki() {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
      <p className="text-gray-500 font-medium mb-1">Wiki is empty</p>
      <p className="text-gray-400 text-sm mb-4">
        Ingest city documents to auto-populate wiki pages.
      </p>
      <code className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded">
        npm run ingest:seed
      </code>
    </div>
  );
}
