import fs from "fs";

export const runtime = "nodejs";

export async function GET() {
  const wikiPath = process.env.WIKI_PATH ?? "./wiki";
  const rawPath = process.env.RAW_SOURCES_PATH ?? "./raw-sources";

  const checks = {
    status: "ok" as "ok" | "degraded",
    ts: Date.now(),
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      WIKI_PATH: wikiPath,
      RAW_SOURCES_PATH: rawPath,
    },
    wiki: {
      indexExists: fs.existsSync(`${wikiPath}/index.md`),
      topicsDir: fs.existsSync(`${wikiPath}/topics`),
      topicCount: 0,
    },
    errors: [] as string[],
  };

  // Count topic pages
  try {
    const topics = fs.readdirSync(`${wikiPath}/topics`).filter(f => f.endsWith(".md"));
    checks.wiki.topicCount = topics.length;
  } catch {
    checks.errors.push("Cannot read wiki/topics/");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    checks.errors.push("ANTHROPIC_API_KEY is not set");
    checks.status = "degraded";
  }

  if (!checks.wiki.indexExists) {
    checks.errors.push("wiki/index.md not found — run ingest:seed");
    checks.status = "degraded";
  }

  return Response.json(checks, {
    status: checks.status === "ok" ? 200 : 503,
  });
}
