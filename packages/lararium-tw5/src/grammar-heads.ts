/**
 * grammar-heads — THE ONE PLACE THAT ANSWERS WHICH HEADS THE GRAMMAR KNOWS.
 *
 * ── THE FOURTH QUESTION, AND THE LAST ONE ANSWERED TWICE ────────────────────────────────────────
 * `carrier-head` collapsed nine spellings of the framing bearing. `sigil-attrs` collapsed five of the
 * parameter question. `carrier-files` collapsed twenty-three of "what counts as the corpus". This
 * answers the fourth: WHICH HEADS CAN A `<<~ …>>` CALL WEAR?
 *
 * Four readers each rebuilt it from a different artifact — two inside the VM off the tag, one off the
 * packed plugin's tiddler TITLES, one off `ls tiddlers/sigil-*.tid`. Two of those read filenames, and
 * a filename is not a head.
 *
 * ── A HEAD IS WHAT A CALL WEARS ─────────────────────────────────────────────────────────────────
 * Read off filenames the shelf reports EIGHTY-SEVEN heads; read off what a call must match, SEVENTY-
 * FOUR. `sigil-frame-etx` patterns a CONTROL MARK, `sigil-dispatcher` patterns nothing at all, and a
 * family index names a family. A reader counting files swears all of them into the grammar — measured
 * the first time this house censused the harvester's coverage, which reported 87 for exactly that.
 *
 * So a head arrives by NAME and stays only when a `<<~`-opening pattern spells it. That admits `ahu`,
 * whose opener reads `<<~[^>]*\bahu\s+…` and matches no fixed prefix, and refuses every control mark,
 * whose patterns open `<<^`.
 *
 * ── THE VM BREATHES, OR THE PLUGIN ANSWERS — AND NEVER A THIRD DOOR ─────────────────────────────
 * RULED: a reader reaches the tag INSIDE THE VM wherever a wiki holds the grammar. ONE fallback
 * stands beside it — {@link grammarHeadsFromPlugin} — for a reader whose wiki holds no grammar: a
 * witness booting vanilla TiddlyWiki as its parse oracle, or a turn capture running while no daemon
 * breathes.
 *
 * THAT FALLBACK FAILS GRACEFULLY. A plugin it cannot read yields an empty set and never a throw,
 * because a capture that cannot name the grammar must still record the turn — the same law the
 * harvester keeps when it meets a head it does not know.
 */

import { GRAMMAR_TAG } from "@lararium/mesh/lar-uris";
export { GRAMMAR_TAG };

/** The fields a grammar tiddler carries that this reader looks at. */
interface HeadFields {
  readonly title?: unknown;
  readonly "lar-kind"?: unknown;
  readonly "lar-name"?: unknown;
  readonly "lar-pattern"?: unknown;
  readonly "lar-open-pattern"?: unknown;
}

/** Just enough wiki to ask the question — so a caller passes the wiki it already holds. */
export interface HeadWiki {
  filterTiddlers(filter: string): string[];
  getTiddler(title: string): { fields?: HeadFields } | undefined;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The sigil's own name: `lar-name` where it stands, else the title's `sigil-` suffix. */
function nameOf(title: string, fields: HeadFields): string {
  const named = str(fields["lar-name"]);
  if (named) return named.toLowerCase();
  const last = title.split("/").pop() ?? title;
  return (last.startsWith("sigil-") ? last.slice(6) : last).toLowerCase();
}

/**
 * A head, or nothing.
 *
 * A FAMILY NAMES A FAMILY. `lar-kind: family` indexes a group and patterns no call.
 * A CONTROL MARK OPENS `<<^`. Only a pattern that opens `<<~` describes a sigil call, and the name
 * must stand inside it — a tiddler whose pattern never spells its own name patterns something else.
 */
function headOf(title: string, fields: HeadFields): string | null {
  if (str(fields["lar-kind"]) === "family") return null;
  const name = nameOf(title, fields);
  if (!name) return null;
  const spelt = new RegExp(`\\\\?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  for (const f of ["lar-pattern", "lar-open-pattern"] as const) {
    const p = str(fields[f]);
    if (p.includes("<<~") && spelt.test(p)) return name;
  }
  return null;
}

/** A rule as the grammar cache builds it — enough of one to read a head off. */
export interface HeadRule {
  readonly name?: unknown;
  readonly kind?: unknown;
  readonly pattern?: unknown;
  readonly openPattern?: unknown;
}

/**
 * Every head a set of BUILT RULES knows — the same reading, entered from the cache rather than the
 * wiki. A caller already holding `getGrammar()` pays no second filter for the same answer, and the
 * two entries share one implementation so they cannot drift apart.
 */
export function grammarHeadsOf(rules: { sigils?: readonly HeadRule[] } | undefined | null): Set<string> {
  const heads = new Set<string>();
  for (const r of rules?.sigils ?? []) {
    const head = headOf(str(r.name), {
      "lar-kind":         r.kind,
      "lar-name":         r.name,
      "lar-pattern":      r.pattern,
      "lar-open-pattern": r.openPattern,
    });
    if (head) heads.add(head);
  }
  return heads;
}

/**
 * Every head the grammar in THIS WIKI knows — the canonical read.
 *
 * THE GRAMMAR ARRIVES AS SHADOWS. Its tiddlers ride inside the plugin, so a filter naming the tiddler
 * store alone matches zero in every wiki that boots the grammar as a plugin — which is every vessel.
 * Shadows first, so a non-shadow tiddler of the same title overrides the packed one.
 *
 * A wiki holding no grammar answers with an empty set; nothing here throws.
 */
export function grammarHeads(wiki: HeadWiki | undefined | null): Set<string> {
  const heads = new Set<string>();
  if (!wiki?.filterTiddlers) return heads;
  let titles: string[] = [];
  try { titles = wiki.filterTiddlers(`[all[shadows+tiddlers]tag[${GRAMMAR_TAG}]]`) ?? []; }
  catch { return heads; }
  for (const title of titles) {
    const fields = wiki.getTiddler?.(title)?.fields;
    if (!fields) continue;
    const head = headOf(title, fields);
    if (head) heads.add(head);
  }
  return heads;
}

/**
 * THE ONE FALLBACK — the same question asked of a packed plugin.
 *
 * For a reader whose wiki holds no grammar: a witness booting vanilla TiddlyWiki as its parse oracle,
 * or a turn capture running while no daemon breathes. It answers what {@link grammarHeads} answers,
 * off the same fields, so the two doors cannot disagree.
 *
 * Anything it cannot read yields an empty set — a capture that cannot name the grammar still records
 * its turn, and a witness that finds nothing reports nothing rather than dying.
 */
export function grammarHeadsFromPlugin(plugin: { text?: unknown } | undefined | null): Set<string> {
  const heads = new Set<string>();
  const text = str(plugin?.text);
  if (!text) return heads;
  let tiddlers: Record<string, HeadFields> | null = null;
  try { tiddlers = (JSON.parse(text) as { tiddlers?: Record<string, HeadFields> }).tiddlers ?? null; }
  catch { return heads; }
  if (!tiddlers || typeof tiddlers !== "object") return heads;
  for (const [title, fields] of Object.entries(tiddlers)) {
    if (!fields || typeof fields !== "object") continue;
    if (!String((fields as { tags?: unknown }).tags ?? "").includes(GRAMMAR_TAG)) continue;
    const head = headOf(title, fields);
    if (head) heads.add(head);
  }
  return heads;
}
