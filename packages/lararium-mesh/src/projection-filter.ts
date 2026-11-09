/**
 * projection-filter — THE ONE RULE for what may reach plaintext disk, written as TiddlyWiki filters.
 *
 * TiddlyWiki's syncer saves what `$:/config/SyncFilter` selects; the house's disk projector is a syncer to files, and its
 * rule takes the same shape: filter tiddlers in TiddlyWiki's own `$:/config/` namespace, shipped in the memetic-wikitext
 * plugin (so each wiki reads them as shadows an operator may override):
 *
 *   $:/config/lares/ProjectionFilter                  every mirror: TW5's own volatile temp and state namespaces
 *   $:/config/lares/ProjectionFilter/temp             a wiki's user temp layer: the system namespace and the house config
 *
 * The filter carries operator preferences for TW5's temp/state namespaces and the user temp class. It does not choose a
 * record's home and does not authorize disk ingress. A mirror class reads the base filter and its own, so each class's
 * preference stays in a short list beside the others.
 *
 * Where a TiddlyWiki engine stands (an island), the live tiddler text runs through `wiki.filterTiddlers`, and the house's
 * `[lar-path[]]` operator (`@lararium/tw5` `filters/lar-path`) maps a title to {@link resolvedTitlePath} there. Where none
 * stands (a CLI scan, a projector under test), {@link filterSelects} runs the SAME text over the operator subset these
 * filters use: `prefix`, `suffix`, `match`, `regexp` (each negatable with `!`) and `lar-path`. An operator outside that
 * subset reads the filter as unreadable, and the caller withholds.
 *
 * Imports nothing: the plugin's `lar-path` module inlines it.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

/** The base filter's title, and each mirror class's own. */
export const PROJECTION_FILTER = "$:/config/lares/ProjectionFilter";
export type ProjectionClass = "temp";
export const projectionFilterTitle = (cls: ProjectionClass): string => `${PROJECTION_FILTER}/${cls}`;

/**
 * The shipped preferences. The plugin build writes each into its `$:/config/` tiddler from here
 * (`tiddlers/config-projection-filter*.tid`), so the shipped shadow and this default read one source.
 */
export const PROJECTION_FILTER_TEXT: Readonly<Record<"base" | ProjectionClass, string>> = {
  base: [
    "[prefix[$:/temp/]]",
    "[prefix[$:/state/]]",
  ].join("\n"),
  temp: "[prefix[lar:///ha.ka.ba/lararium/config/]]",
};

/**
 * The path a title resolves to, read the way a reader resolves a URL: the scheme lower-cased, each percent escape decoded
 * (a malformed one keeps its bytes), and the `.` and `..` segments folded. A rule that reads a title by prefix reads it
 * here first (`[lar-path[]prefix[…]]`), so no spelling of a path slips past the prefix it resolves to.
 */
export function resolvedTitlePath(title: string): string {
  const scheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.exec(title)?.[0] ?? "";
  let rest = title.slice(scheme.length);
  try { rest = decodeURIComponent(rest); } catch { /* a malformed escape keeps its bytes */ }
  const segments = rest.split("/");
  let leading = 0;
  while (leading < segments.length && segments[leading] === "") leading++;
  const out: string[] = Array(leading).fill("");
  for (const segment of segments.slice(leading)) {
    if (segment === "") continue;
    if (segment === ".") continue;
    if (segment === ".." && out.length > leading && out[out.length - 1] !== "") { out.pop(); continue; }
    out.push(segment);
  }
  return scheme.toLowerCase() + out.join("/");
}

/** A filter text this evaluator cannot read: the caller withholds rather than guess. */
export class ProjectionFilterUnreadable extends Error {
  override readonly name = "ProjectionFilterUnreadable";
}

interface Step { readonly negate: boolean; readonly op: string; readonly operand: string }

/** Parse a filter text into runs of steps: `[op[operand]op[operand]…]`, runs apart by whitespace. */
function parseRuns(text: string): Step[][] {
  const runs: Step[][] = [];
  let i = 0;
  const fail = (why: string): never => { throw new ProjectionFilterUnreadable(`${why} at ${i} in ${JSON.stringify(text)}`); };
  while (i < text.length) {
    if (/\s/.test(text[i]!)) { i++; continue; }
    if (text[i] !== "[") fail("a run opens with `[`");
    i++;
    const steps: Step[] = [];
    while (text[i] !== "]") {
      if (i >= text.length) fail("an unclosed run");
      const negate = text[i] === "!";
      if (negate) i++;
      const name = /^[a-z][a-z0-9-]*/.exec(text.slice(i))?.[0];
      if (!name) fail("a step names no operator");
      i += name!.length;
      if (text[i] !== "[") fail("an operand opens with `[`");
      const close = text.indexOf("]", i + 1);
      if (close < 0) fail("an unclosed operand");
      steps.push({ negate, op: name!, operand: text.slice(i + 1, close) });
      i = close + 1;
    }
    i++;
    if (steps.length === 0) fail("an empty run");
    runs.push(steps);
  }
  return runs;
}

const compiled = new Map<string, Step[][]>();
const regexps = new Map<string, RegExp>();

function step(titles: string[], s: Step): string[] {
  const keep = (pass: (t: string) => boolean): string[] => titles.filter((t) => pass(t) !== s.negate);
  switch (s.op) {
    case "prefix": return keep((t) => t.startsWith(s.operand));
    case "suffix": return keep((t) => t.endsWith(s.operand));
    case "match": return keep((t) => t === s.operand);
    case "regexp": {
      let re = regexps.get(s.operand);
      if (!re) { re = new RegExp(s.operand); regexps.set(s.operand, re); }
      return keep((t) => re!.test(t));
    }
    case "lar-path":
      if (s.negate || s.operand !== "") throw new ProjectionFilterUnreadable("`lar-path` takes no operand and no `!`");
      return titles.map(resolvedTitlePath);
    default: throw new ProjectionFilterUnreadable(`the operator \`${s.op}\` stands outside the projection subset`);
  }
}

/** Whether any run of `text` selects `title`, run over a one-title source. */
export function filterSelects(text: string, title: string): boolean {
  let runs = compiled.get(text);
  if (!runs) { runs = parseRuns(text); compiled.set(text, runs); }
  return runs.some((run) => run.reduce<string[]>((titles, s) => step(titles, s), [title]).length > 0);
}

/** Reads a filter tiddler's text where an engine holds one; absent, the shipped default answers. */
export type ProjectionFilterText = (title: string) => string | undefined;

/**
 * THE ONE VERDICT: whether `title` stays off plaintext disk for a mirror (and a wave) of the classes named. The base filter
 * always reads; each class adds its own. A filter text the evaluator cannot read withholds.
 */
export function projectionWithheld(title: string, classes: readonly ProjectionClass[] = [], read?: ProjectionFilterText): boolean {
  const texts = [read?.(PROJECTION_FILTER) ?? PROJECTION_FILTER_TEXT.base, ...classes.map((c) => read?.(projectionFilterTitle(c)) ?? PROJECTION_FILTER_TEXT[c])];
  try { return texts.some((text) => filterSelects(text, title)); }
  catch (e) { if (e instanceof ProjectionFilterUnreadable) return true; throw e; }
}
