import { notFound } from "next/navigation";
import Link from "next/link";
import { readWikiPage, readWikiIndex } from "../../lib/wiki/reader";
import { marked } from "marked";
import { ArrowLeft, Clock, FileText } from "lucide-react";
import type { WikiCategory } from "../../types";

export const revalidate = 300;

const CATEGORY_COLORS: Record<WikiCategory, string> = {
  topic: "bg-blue-50 text-blue-700 border-blue-200",
  decision: "bg-amber-50 text-amber-700 border-amber-200",
  person: "bg-green-50 text-green-700 border-green-200",
  recommendation: "bg-red-50 text-red-700 border-red-200",
  query: "bg-purple-50 text-purple-700 border-purple-200",
};

interface Props {
  params: Promise<{ slug: string[] }>;
}

export default async function WikiDetailPage({ params }: Props) {
  const { slug } = await params;

  // Reconstruct the path: e.g. ["topics", "budget"] → "topics/budget.md"
  const rawPath = slug.join("/");
  const pagePath = rawPath.endsWith(".md") ? rawPath : `${rawPath}.md`;

  const page = readWikiPage(pagePath);
  if (!page) notFound();

  // Render markdown → HTML
  const htmlContent = await marked.parse(page.content, { async: true });

  // Find related pages (same category, different path)
  const allEntries = readWikiIndex();
  const related = allEntries
    .filter((e) => e.category === page.category && e.path !== pagePath)
    .slice(0, 5);

  const categoryLabel: Record<WikiCategory, string> = {
    topic: "Topic",
    decision: "Decision",
    person: "Person",
    recommendation: "Recommendation",
    query: "Saved Q&A",
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Back nav */}
        <Link
          href="/wiki"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-city-navy mb-5 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Wiki
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[page.category]}`}
            >
              {categoryLabel[page.category]}
            </span>
            {page.sources.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <FileText size={11} />
                {page.sources.length} source{page.sources.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-city-navy">{page.title}</h1>
          {page.lastUpdated && (
            <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
              <Clock size={11} />
              Updated {page.lastUpdated}
            </p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Main content */}
          <div className="col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div
                className="prose prose-sm max-w-none prose-headings:text-city-navy prose-a:text-city-navy prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Sources */}
            {page.sources.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Sources
                </h3>
                <ul className="space-y-1">
                  {page.sources.map((src) => (
                    <li key={src} className="text-xs text-gray-600 truncate">
                      {src}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related pages */}
            {related.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Related
                </h3>
                <ul className="space-y-1.5">
                  {related.map((entry) => {
                    const title = entry.path
                      .replace(/^(topics|decisions|people|recommendations|queries)\//, "")
                      .replace(/\.md$/, "")
                      .replace(/-/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <li key={entry.path}>
                        <Link
                          href={`/wiki/${encodeURIComponent(entry.path.replace(/\.md$/, ""))}`}
                          className="text-xs text-city-navy hover:underline truncate block"
                        >
                          {title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
