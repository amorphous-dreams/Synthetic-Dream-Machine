/**
 * daemon-flow-tiddlers — seed the pet-named FLOW tiddlers into the daemon wiki's shadow layer.
 *
 * Each seed FLOW (crystal · rhythm · couple) lands as one tiddler addressed by its own `lar:` URI pet-name
 * (buildFlowTiddler stamps title/authority/bag). The daemon dispatcher reads them — the verb-tiddler
 * protocol — to run a flow by pet-name; the runner ALSO reads FLOW_SEEDS from code, so a vessel that never
 * seeds still runs every flow (the tiddlers make the flow-set ADDRESSABLE in the wiki, not runnable).
 *
 * The capStack rides the COMPACT `instrument:hull …` list-string form parseCapStack reads back (never a JSON
 * blob in a tiddler field). Idempotent (each call re-lays the shadow plugin). Seed alongside the other daemon seeds,
 * BEFORE the projection's first render.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/flow
 */

import { enactableFlows, buildFlowTiddler, HULLS_TS_ONLY, type RunnableHulls } from "@lararium/mesh";
import type { TW5Engine } from "./tw5-vm.js";
import { seedShadows } from "./daemon-ui-tiddlers.js";

/** A stable seed timestamp — the flow tiddlers ride the cache-stable boot, so they carry a FIXED marker,
 *  never a wall-clock stamp (a Date.now() would break the deterministic genesis quine). */
const FLOW_SEED_STAMP = "seed";

/** Seed the FLOW tiddlers this vessel CAN ENACT into the live daemon wiki — cap-gated by `runnableHulls`
 *  (a ts-only vessel seeds crystal; a full node vessel seeds all three). The seeded set names the flows this
 *  vessel can enact; it rests in the shadow layer, so it stays on this device. `authority` names the writer. */
export function seedDaemonFlowTiddlers(
  tw5: TW5Engine, runnableHulls: RunnableHulls = HULLS_TS_ONLY, authority = "lararium-seed",
): void {
  seedShadows(tw5, "flows", enactableFlows(runnableHulls).map((seed) => {
    const t = buildFlowTiddler(seed, authority, FLOW_SEED_STAMP);
    return {
      title:     t.title,
      petname:   t.petname,
      summary:   t.summary,
      arity:     t.arity,
      authority: t.authority,
      bag:       t.bag,
      updatedAt: t.updatedAt,
      // The compact list form: `instrument:hull instrument:hull …` (parseCapStack reads it back).
      capStack:  t.capStack.map((s) => `${s.instrument}:${s.hull}`).join(" "),
      "flow-seed": "true",
    };
  }));
}
