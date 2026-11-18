/**
 * seat-startup-offer — the one wall a seat keeps (state/decisions, "Native TW5 wikis, and the one wall a seat keeps").
 *
 * Each live wiki behaves as a native TiddlyWiki: a record lands whatever it carries, and a module, script or plugin record
 * reads as data on the server-side island (its code comes from the floor-admitted preloads alone). A `$:/tags/StartupAction`
 * record (or a tag beneath it) runs in the tab alone, never on the island, so a startup action the AI seat lands would run
 * in the operator's browser. A seat-asked write carrying such a tag therefore OFFERS and never lands: every write door (the
 * tiddler door, `meme put`, INGEST) calls `refuseSeatStartupAction` over each record it would land, and the refusal names
 * the operator's own hand. Every other asker (the operator's CLI, the tab, a door that read no asker) lands natively.
 */
import { VerbRefusal } from "./verb-refusal.js";
import type { Hand } from "./session-contract.js";

/** The refusal reason a write door raises for an AI seat's startup action. */
export const SEAT_STARTUP_OFFER_REASON = "seat-startup-offer" as const;

const STARTUP_TAG = "$:/tags/StartupAction";

/** A tag list as TiddlyWiki carries it: an array, or a string list (`one [[two words]]`). */
function tagsOf(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.filter((tag): tag is string => typeof tag === "string");
  if (typeof tags !== "string") return [];
  const out: string[] = [];
  for (const m of tags.matchAll(/\[\[([^\]]*)\]\]|(\S+)/g)) out.push(m[1] ?? m[2]!);
  return out;
}

/** The startup tag a record's tags carry (`$:/tags/StartupAction` or a tag beneath it), or null. */
export function startupTagOf(tags: unknown): string | null {
  return tagsOf(tags).find((tag) => tag === STARTUP_TAG || tag.startsWith(`${STARTUP_TAG}/`)) ?? null;
}

/**
 * Throws a `VerbRefusal` (reason `seat-startup-offer`) where the asker reads `seat` and the record's tags carry a startup
 * tag; returns otherwise. `act` names the door; nothing lands where it throws, so a door calls it before its first write.
 */
export function refuseSeatStartupAction(title: string, tags: unknown, act: string, asker: Hand | undefined): void {
  if (asker !== "seat") return;
  const tag = startupTagOf(tags);
  if (tag === null) return;
  throw new VerbRefusal(SEAT_STARTUP_OFFER_REASON,
    `${SEAT_STARTUP_OFFER_REASON}: ${act} of "${title}" refused — it carries the startup tag "${tag}", and a wiki's startup action runs in the operator's tab, so the AI seat offers it and never lands it; land the record without that tag (it lands as data), and the tag rides the operator's own hand (in the tab, or from the operator's own terminal).`);
}
