/**
 * `lares handle publish <glamour>` — publish this persona's public "here I am" note (a Handle).
 *
 * A Handle is the outward face a peer recognises again: a self-certifying card carrying a display glamour,
 * announced onto the Nexus's WHO board. It anchors to its persona (the daemon doc's persona-KEL prefix owns
 * it), so a lost presentation key recovers through the persona; publishing a face with no persona to own it
 * refuses rather than self-owns. All logic lives in @lararium/node (runHandlePublish); this dispatches.
 */
import type { ParsedArgs } from "../parse-args.js";
import { runHandlePublish } from "@lararium/node";

export async function cmdHandle(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub !== "publish") {
    console.error('[lares handle] usage: lares handle publish "<glamour>" [--persona <index>]');
    return 2;
  }
  const glamour = args.positional[1] ?? args.options["glamour"];
  if (!glamour) {
    console.error('[lares handle publish] a glamour (display name) is required: lares handle publish "Guru-Josh"');
    return 2;
  }
  const opts: Parameters<typeof runHandlePublish>[0] = { glamour };
  if (args.options["persona"] !== undefined) Object.assign(opts, { handleIndex: Number(args.options["persona"]) });
  const card = await runHandlePublish(opts);
  console.log(`[lares handle] published "${card.glamour}" — nym ${card.nym.slice(0, 24)}… (v${card.version})`);
  return 0;
}
