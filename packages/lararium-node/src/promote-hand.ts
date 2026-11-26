/**
 * promote-hand — the socket's read of a PROMOTE: an act that moves a working record into house canon.
 *
 * Operator ruling (2026-11-26): a change to a canon file on disk lands in the working layer, and promotion to canon takes
 * the human hand. Two doors promote: a MOVE whose destination stands in house canon (`lares meme promote`, `lares act MOVE`,
 * alone or inside a `wiki-act`), and `offer-promote` (`lares meme offer promote <cid>`). The island refuses an AI seat at
 * both (`seat-canon-reach`, `requireKahuReach`). A line whose peer reads NOTHING books no asker, and the island's gate reads
 * an absent asker as the house's own road, so the socket refuses that line here (`hand-unattested`), before it places.
 *
 * The read folds case and reads the routing fields as the handler does (a string, or no match), as `shoreHandCode` does.
 */

import { isHouseCanonBag } from "@lararium/mesh/kahu-canon-reach";

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** Whether a MOVE's args name a destination in house canon (`to-bag`, or the camel spelling a caller may send). */
function movesIntoCanon(args: Readonly<Record<string, unknown>>): boolean {
  const to = text(args["to-bag"]) ?? text(args["toBag"]);
  return to !== null && isHouseCanonBag(to);
}

/** Whether one socket call promotes into house canon: `offer-promote`, or a MOVE into a canon bag, bare or inside a `wiki-act`. */
export function promotesIntoCanon(verb: string, args: unknown): boolean {
  const a = (args !== null && typeof args === "object" && !Array.isArray(args) ? args : {}) as Record<string, unknown>;
  const folded = verb.toLowerCase();
  if (folded === "offer-promote") return true;
  if (folded === "move") return movesIntoCanon(a);
  if (folded !== "wiki-act") return false;
  const inner = text(a["verb"])?.toLowerCase() ?? null;
  const innerArgs = a["args"] !== null && typeof a["args"] === "object" && !Array.isArray(a["args"]) ? a["args"] as Record<string, unknown> : {};
  if (inner === "offer-promote") return true;
  return inner === "move" && movesIntoCanon(innerArgs);
}
