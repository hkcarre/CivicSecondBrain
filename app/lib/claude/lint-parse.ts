/**
 * Truncation-tolerant parsing for the LINT AI response.
 *
 * With a rich wiki context the model can exceed its output-token cap, leaving
 * the JSON cut off mid-array. A truncated 6th recommendation must not discard
 * five complete ones (#262): when strict parsing fails, salvage every
 * COMPLETE object from the "recommendations" array and return it with empty
 * stalePages/topActions.
 */

export interface LintResult {
  recommendations: unknown[];
  stalePages: string[];
  topActions: string[];
  /** True when the response was truncated and partially salvaged. */
  truncated?: boolean;
}

export function parseLintResponse(text: string): LintResult {
  const jsonMatch =
    text.match(/```json\n?([\s\S]+?)\n?```/) ?? text.match(/\{[\s\S]+\}/);

  // A truncated response has an opening fence/brace but no closing one —
  // fall back to everything after the first "{" so salvage can still run.
  const raw = jsonMatch
    ? jsonMatch[jsonMatch.length - 1]
    : text.slice(text.indexOf("{"));

  if (text.indexOf("{") === -1) {
    throw new Error("Claude returned no parseable JSON");
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      recommendations: parsed.recommendations ?? [],
      stalePages: parsed.stalePages ?? [],
      topActions: parsed.topActions ?? [],
    };
  } catch {
    const salvaged = salvageArrayObjects(raw, "recommendations");
    if (salvaged.length === 0) {
      throw new Error(
        "Claude returned no parseable JSON (response truncated beyond repair)"
      );
    }
    return {
      recommendations: salvaged,
      stalePages: [],
      topActions: [],
      truncated: true,
    };
  }
}

/**
 * Extract every complete `{…}` object from the named array in a possibly
 * truncated JSON string, via string-aware brace matching.
 */
function salvageArrayObjects(raw: string, arrayKey: string): unknown[] {
  const keyIdx = raw.indexOf(`"${arrayKey}"`);
  if (keyIdx === -1) return [];
  const arrStart = raw.indexOf("[", keyIdx);
  if (arrStart === -1) return [];

  const objects: unknown[] = [];
  let i = arrStart + 1;

  while (i < raw.length) {
    // Find the next object start (or the end of the array)
    while (i < raw.length && raw[i] !== "{" && raw[i] !== "]") i++;
    if (i >= raw.length || raw[i] === "]") break;

    const objStart = i;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let objEnd = -1;

    for (; i < raw.length; i++) {
      const ch = raw[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          objEnd = i;
          break;
        }
      }
    }

    if (objEnd === -1) break; // incomplete object — truncation point reached

    try {
      objects.push(JSON.parse(raw.slice(objStart, objEnd + 1)));
    } catch {
      break; // malformed even though braces balanced — stop salvaging
    }
    i = objEnd + 1;
  }

  return objects;
}
