/**
 * short-title — A SEAT NAMES A STAGE RECORD SHORT, AND THE DOOR READS THE FULL TITLE (S6, course/ai-surface-gestures).
 *
 * A seat naming memory-stage memes all day writes `kahua:road/x`, and every tiddler door reads
 * `lar:///ha.ka.ba/kahua/memory/road/x`: has-stack clause 2's relative addresses, at the door. The expansion lives HERE
 * alone, pure, in the wiki VM's own core: the vessel's tiddler verbs call it on every title they take (node and browser
 * alike), so the CLI and the MCP seat send the short form as written and read the full title back. The short form never
 * becomes a second name for one relation: no record stands at it, and every answer names the full title.
 *
 * THE PREFIXES STAND CLOSED. Each prefix names the root a law already declares (`kahua` → the stage meme law's
 * `STAGE_MEME_PREFIX`, road `L9`); a prefix no law declares refuses by name (`short-title-unknown`) and names the prefixes
 * that stand. A title outside the short shape (a `lar:///` address, a `$:/` title, a title with a space or a capital) rides
 * through untouched; a known prefix with no path refuses `short-title-empty`.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/course/ai-surface-gestures#/stories · lar:///ha.ka.ba/lares/api/pono/has-stack
 */
import { STAGE_MEME_PREFIX } from "./place-meme.js";

/** The closed set: each short prefix and the full root a law declares for it. */
export const SHORT_TITLE_PREFIXES: Readonly<Record<string, string>> = Object.freeze({ kahua: STAGE_MEME_PREFIX });

export const SHORT_TITLE_UNKNOWN_CODE = "short-title-unknown";
export const SHORT_TITLE_EMPTY_CODE = "short-title-empty";

/** `<prefix>:<rest>`, the rest opening on no `/` (so `lar:///…`, `ni:///…` and `https://…` ride through). */
const SHORT_SHAPE = /^([a-z][a-z0-9-]*):(?!\/)(.*)$/s;
/** The path a short form reads: lowercase hyphen-joined segments, an optional `#/slot` after them. */
const SHORT_PATH = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*(?:#\/\S*)?$/;

export type ShortTitleReading =
  | { readonly kind: "full"; readonly title: string }
  | { readonly kind: "expanded"; readonly title: string; readonly prefix: string }
  | { readonly kind: "refused"; readonly code: string; readonly message: string };

/** The prefixes that stand, as a refusal names them: `kahua: (lar:///ha.ka.ba/kahua/memory/)`. */
export function shortTitlePrefixesLine(): string {
  return Object.entries(SHORT_TITLE_PREFIXES).map(([name, root]) => `${name}: (${root})`).join(", ");
}

/** One title read through the closed set: the full title as named, the expansion, or the refusal and its cure. */
export function readShortTitle(title: string): ShortTitleReading {
  const shaped = SHORT_SHAPE.exec(title);
  if (shaped === null) return { kind: "full", title };
  const [, prefix = "", rest = ""] = shaped;
  const root = Object.hasOwn(SHORT_TITLE_PREFIXES, prefix) ? SHORT_TITLE_PREFIXES[prefix] : undefined;
  const standing = shortTitlePrefixesLine();
  if (root !== undefined) {
    if (rest === "" || rest.startsWith("#")) {
      return { kind: "refused", code: SHORT_TITLE_EMPTY_CODE, message: `${SHORT_TITLE_EMPTY_CODE}: "${title}" names the prefix "${prefix}:" and no path under it; name the record (\`${prefix}:road/x\` reads \`${root}road/x\`), or its full title.` };
    }
    return { kind: "expanded", title: `${root}${rest}`, prefix };
  }
  // A title that merely holds a colon (`did:key:z6…`, `Note: draft`) rides through; a stage-shaped path under an unknown prefix refuses.
  if (!SHORT_PATH.test(rest)) return { kind: "full", title };
  const [first = ""] = Object.keys(SHORT_TITLE_PREFIXES);
  return { kind: "refused", code: SHORT_TITLE_UNKNOWN_CODE, message: `${SHORT_TITLE_UNKNOWN_CODE}: "${title}" names the prefix "${prefix}:", which no law declares; the prefixes that stand: ${standing}. Name one (\`${first}:${rest}\`), or the record's full title.` };
}
