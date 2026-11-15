/**
 * Which memes cite which source files.
 *
 * A path with a directory resolves by exact repo path, then by the one file whose path ends with it.
 * A bare basename counts only inside backticks and resolves only where one source file carries it;
 * a name two or more files carry lands on `ambiguous` and in no file's cited-by. Nothing guesses.
 */

const EXT = "(?:tsx|ts|mjs|cjs|js|py)";
const PATH_RE = new RegExp(`[A-Za-z0-9_@.\\-]+(?:/[A-Za-z0-9_@.\\-]+)+\\.${EXT}(?![A-Za-z0-9_])`, "g");
const BASE_RE = new RegExp(`\`([A-Za-z0-9_.\\-]+\\.${EXT})(?![A-Za-z0-9_])`, "g");

/** The title a meme names in its first toml fence, or "". */
export function memeTitle(text) {
  const fence = /```toml[^\n]*\n([\s\S]*?)\n```/.exec(text);
  const m = fence && /^title\s*=\s*"([^"]+)"/m.exec(fence[1]);
  return m ? m[1] : "";
}

/**
 * `memes` carries `{ title, text }`; `paths` lists every source repo path.
 * Returns `{ citedBy: Map<path, Set<title>>, ambiguous: Map<name, Set<candidate path>> }`.
 */
export function findCites(memes, paths) {
  const pathSet = new Set(paths);
  const byBase = new Map();
  for (const p of paths) {
    const b = p.slice(p.lastIndexOf("/") + 1);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(p);
  }
  const suffixCache = new Map();
  const suffixMatches = (tok) => {
    if (!suffixCache.has(tok)) {
      const base = tok.slice(tok.lastIndexOf("/") + 1);
      suffixCache.set(tok, (byBase.get(base) ?? []).filter((p) => p.endsWith(`/${tok}`)));
    }
    return suffixCache.get(tok);
  };
  const citedBy = new Map();
  const ambiguous = new Map();
  const cite = (p, title) => {
    if (!citedBy.has(p)) citedBy.set(p, new Set());
    citedBy.get(p).add(title);
  };
  const ambiguate = (name, cands) => {
    if (!ambiguous.has(name)) ambiguous.set(name, new Set());
    for (const c of cands) ambiguous.get(name).add(c);
  };
  for (const { title, text } of memes) {
    if (!title) continue;
    for (const m of text.matchAll(PATH_RE)) {
      const tok = m[0].replace(/^\.\//, "");
      if (pathSet.has(tok)) cite(tok, title);
      else {
        const hits = suffixMatches(tok);
        if (hits.length === 1) cite(hits[0], title);
        else if (hits.length > 1) ambiguate(tok, hits);
      }
    }
    for (const m of text.matchAll(BASE_RE)) {
      const hits = byBase.get(m[1]) ?? [];
      if (hits.length === 1) cite(hits[0], title);
      else if (hits.length > 1) ambiguate(m[1], hits);
    }
  }
  return { citedBy, ambiguous };
}
