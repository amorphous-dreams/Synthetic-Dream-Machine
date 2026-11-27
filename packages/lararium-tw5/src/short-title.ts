/**
 * short-title — A SEAT NAMES A STAGE RECORD SHORT, AND THE DOOR READS THE FULL TITLE (S6, course/ai-surface-gestures).
 *
 * A seat naming memory-stage memes all day writes `kahua:road/x`, and every tiddler door reads
 * `lar:///ha.ka.ba/kahua/memory/road/x`: has-stack clause 2's relative addresses, at the door. The expansion lives HERE
 * alone, pure, in the wiki VM's own core: the vessel's tiddler verbs call it on every title they take (node and browser
 * alike), so the CLI and the MCP seat send the short form as written and read the full title back. The short form never
 * becomes a second name for one relation: no record stands at it, and every answer names the full title.
 *
 * THE PREFIXES STAND CLOSED, AND A TITLE STAYS A TITLE. Each prefix names the root a law already declares (`kahua` → the
 * stage meme law's `STAGE_MEME_PREFIX`, road `L9`); every other title rides through as named, a colon in it included
 * (`todo:buy-milk`, `did:key:z6…`), since the door never guesses which colons in a name mean a prefix. Where such a title
 * reads absent and carries the short shape, `shortTitleHint` names the prefixes that stand, so the cure rides the
 * not-found answer. A known prefix with no path refuses `short-title-empty`.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/course/ai-surface-gestures#/stories · lar:///ha.ka.ba/lares/api/pono/has-stack
 */
import { STAGE_MEME_PREFIX } from "./place-meme.js";

/** The closed set: each short prefix and the full root a law declares for it. */
export const SHORT_TITLE_PREFIXES: Readonly<Record<string, string>> = Object.freeze({ kahua: STAGE_MEME_PREFIX });

export const SHORT_TITLE_EMPTY_CODE = "short-title-empty";

/** `<prefix>:<rest>`, the rest opening on no `/` (so `lar:///…`, `ni:///…` and `https://…` ride through). */
const SHORT_SHAPE = /^([a-z][a-z0-9-]*):(?!\/)(.*)$/s;
/** The path a short form reads: lowercase hyphen-joined segments, an optional `#/slot` after them. */
const SHORT_PATH = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*(?:#\/\S*)?$/;

export type ShortTitleReading =
  | { readonly kind: "full"; readonly title: string }
  | { readonly kind: "expanded"; readonly title: string; readonly prefix: string }
  | { readonly kind: "refused"; readonly code: string; readonly message: string };

/** The prefixes that stand, as a hint names them: `kahua: → lar:///ha.ka.ba/kahua/memory/`. */
export function shortTitlePrefixesLine(): string {
  return Object.entries(SHORT_TITLE_PREFIXES).map(([name, root]) => `${name}: → ${root}`).join(", ");
}

/** One title read through the closed set: the expansion under a standing prefix, the refusal of an empty one, else the title as named. */
export function readShortTitle(title: string): ShortTitleReading {
  const shaped = SHORT_SHAPE.exec(title);
  if (shaped === null) return { kind: "full", title };
  const [, prefix = "", rest = ""] = shaped;
  const root = Object.hasOwn(SHORT_TITLE_PREFIXES, prefix) ? SHORT_TITLE_PREFIXES[prefix] : undefined;
  if (root === undefined) return { kind: "full", title };
  if (rest === "" || rest.startsWith("#")) {
    return { kind: "refused", code: SHORT_TITLE_EMPTY_CODE, message: `${SHORT_TITLE_EMPTY_CODE}: "${title}" names the prefix "${prefix}:" and no path under it; name the record (\`${prefix}:road/x\` reads \`${root}road/x\`), or its full title.` };
  }
  return { kind: "expanded", title: `${root}${rest}`, prefix };
}

/**
 * The hint a not-found answer carries for a title that rode through in the short shape (`word:path`) under a prefix no law
 * declares, or null for any other title: it names the prefixes that stand and the spelling a standing one reads.
 */
export function shortTitleHint(title: string): string | null {
  const shaped = SHORT_SHAPE.exec(title);
  if (shaped === null) return null;
  const [, prefix = "", rest = ""] = shaped;
  if (Object.hasOwn(SHORT_TITLE_PREFIXES, prefix) || !SHORT_PATH.test(rest)) return null;
  const [first = ""] = Object.keys(SHORT_TITLE_PREFIXES);
  return `"${title}" reads as a title as named; "${prefix}:" names no short prefix. The prefixes that stand: ${shortTitlePrefixesLine()} (\`${first}:${rest}\` reads \`${SHORT_TITLE_PREFIXES[first] ?? ""}${rest}\`).`;
}
