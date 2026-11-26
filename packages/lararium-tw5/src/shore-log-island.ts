/**
 * shore-log-island — the daemon island's half of the vessel's log records (`@lararium/mesh/shore-log`).
 *
 * The host's sink hands each changed record in one `daemon:shore-log` batch; this writes each into the worn face's daemon
 * temp layer (`wikis/daemon/temp`), the device-local, volatile class: a record reaches plaintext only where that layer's
 * mirror stands (the operator's `projection.temp.daemon` consent row), never through a title or a field. A hand's `ack`
 * (the seq it acknowledged, set from `$:/lares/shore/log`) stays across every later write of the same record: the sink
 * owns the event's fields, the hand owns its ack. A composition with no writable temp layer writes nothing.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type ChangeOrigin } from "@lararium/mesh/tiddler-store";
import { readShoreLogPlacement, type ShoreLogPlacement } from "@lararium/mesh/shore-log";
import type { IslandContext } from "./island-context.js";

/** The fields a hand owns on a record: the sink's write never takes them away. */
export const SHORE_LOG_HAND_FIELDS = ["ack"] as const;

/** The fields one record lands with: the sink's own, and the hand's fields the prior record held. */
export function shoreLogLanding(placement: ShoreLogPlacement, prior: Readonly<Record<string, unknown>> | undefined): Record<string, string> {
  const out: Record<string, string> = { ...placement.fields };
  for (const name of SHORE_LOG_HAND_FIELDS) {
    const held = prior?.[name];
    if (typeof held === "string" && held !== "") out[name] = held;
    else delete out[name];
  }
  return out;
}

/** Write one batch into the daemon temp layer. Resolves with the count written; a record that refuses is named and skipped. */
export async function writeShoreLog(ctx: IslandContext, records: readonly unknown[]): Promise<number> {
  const temp = wikiSlotUri(ctx.recipe.wikiSlug, "temp");
  if (!ctx.composite.hasWritableBag(temp)) return 0;
  const wiki = (ctx.tw5 as { $tw?: { wiki?: { getTiddler(title: string): { fields: Record<string, unknown> } | undefined } } } | undefined)?.$tw?.wiki;
  const origin: ChangeOrigin = { kind: "lares-verb", requestId: "shore-log" };
  let written = 0;
  for (const raw of records) {
    const placement = readShoreLogPlacement(raw);
    if (placement === null) continue;
    const landing = shoreLogLanding(placement, wiki?.getTiddler(placement.title)?.fields);
    try {
      await ctx.composite.put({ tiddler: { ...landing, title: placement.title } }, origin, { bag: temp });
      written++;
    } catch (err) {
      // Never console here: the host's tap folds console lines back into records, so a failing write would feed itself.
      void err;
    }
  }
  return written;
}
