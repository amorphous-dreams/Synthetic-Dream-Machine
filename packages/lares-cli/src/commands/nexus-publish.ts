/**
 * nexus-publish — THE OFFERING DOOR: what THIS operator publishes for others to take.
 *
 * ── WHY IT STANDS APART FROM `kahuli` ────────────────────────────────────────────────────────────
 * `kahuli` overturns what the MESH must agree on: `engineCid` (the hearth true-name, signed into every
 * device-delegation edge) and `grammarCid` (the required memetic-wikitext grammar alone). Both ratchet,
 * and an operator who advances one moves everybody's reading.
 *
 * `pluginsCid` names THIS operator's OWN collection. It layers on the required blobs, overturns nobody
 * else's reading, and moves with no ratchet act at all — so it never stood as a kāhuli tier. The kāhuli
 * door said exactly that in its own header while reporting the region anyway, which left an operator
 * walking in through the mesh-grammar door to see their own shelf. This door takes the region back.
 *
 * ── AN OFFERING IS A GIFT, NOT A COLLECTIVE ACT ──────────────────────────────────────────────────
 * A taker verifies the blobs BY HASH against the declared region, so nothing stands for a second hand to
 * attest that the hash does not already settle. The offering carries a signature and an announce; it
 * carries no steward set, and adding one would make a gift into a quorum act (operator ruling).
 *
 * ── TIER-PARAMETERIZED, THE SHAPE `kahuli` ALREADY READS ─────────────────────────────────────────
 * `publish <what>` takes one case per publishable thing, so a second cap arrives as a CASE rather than as
 * another door. `plugins` stands first because the region already exists and already gets folded.
 */

import { readGenesisPluginsCid, readGenesisCasManifest } from "@lararium/node";
import { refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/** What this door may publish today. A new cap lands here beside `plugins`. */
export const PUBLISHABLE = ["plugins"] as const;

const PUBLISH_USAGE: readonly string[] = [
  "usage: lares nexus publish <plugins>",
  "",
  "  THE OFFERING DOOR — what THIS operator publishes for others to take. Held apart from",
  "  `nexus kahuli`, which overturns what the MESH must agree on (engine · grammar).",
  "",
  "    plugins  THIS operator's own collection (pluginsCid). A region, never a ratchet tier:",
  "             it layers on the required blobs and overturns nobody else's reading.",
  "",
  "  --apply    sign the offering + announce it on the crossroads plane (HELD — landing next).",
];

/**
 * `lares nexus publish plugins` — READ the operator's own collection.
 *
 * The read names the region and the blobs it folds. A read never bakes: the collection moves when the
 * operator packs a plugin and re-derives the genesis, and this door reports the result rather than
 * causing it.
 *
 * THE REGION READER STAYS NODE-BOUND ON PURPOSE. The three vessel classes take genesis three deliberately
 * different ways — the web surface statically imports the seed at bundle time, a browser vessel receives one
 * already materialized, and a node vessel reads the baked artifact off disk. Lifting this read behind one
 * injected abstraction would launder that real difference into a false uniformity; the OFFERING itself
 * (the signed record and its announce, landing next) carries no such split and belongs in mesh.
 */
function publishPlugins(args: ParsedArgs): number {
  const pluginsCid = readGenesisPluginsCid();
  const manifest = readGenesisCasManifest();

  if (args.flags["apply"]) {
    console.error("nexus publish plugins --apply — HELD (the offering's payload lands next).");
    console.error("  --apply mints a SIGNED offering record naming the collection, its region cid and its");
    console.error("  blob descriptors, then announces it on the crossroads plane. A taker verifies the");
    console.error("  blobs BY HASH against the declared region, so the offering carries a signature and an");
    console.error("  announce and NO steward set — nothing stands for a second hand to attest.");
    return 2;
  }

  const none = "(no island baked in this root yet)";
  console.log("nexus publish plugins — THIS operator's own collection (a read; nothing built):");
  console.log(`  plugins (pluginsCid): ${pluginsCid ?? none}   a region, never a ratchet tier`);

  // The manifest carries every blob's DECLARED class, so the count reads off what the mint declared
  // rather than off a path — the same law the genesis build folds under.
  const plugins = (manifest?.blobs ?? []).filter((b) => b.id.startsWith("$:/plugins/"));
  if (manifest && plugins.length > 0) {
    console.log(`  the collection holds ${plugins.length}:`);
    for (const b of plugins) console.log(`    ${b.id}  v${b.version}  ${b.cid}`);
  }
  console.log("");
  console.log("  a plugin added or dropped moves THIS region and no other — plugin drift never reads as");
  console.log("  grammar drift, and no peer's epoch moves when yours does.");
  console.log("  the ratchets the MESH shares live at `lares nexus kahuli <engine|grammar>`.");
  return 0;
}

/** `lares nexus publish <what>` — the tier-parameterized offering door. */
export async function cmdPublish(args: ParsedArgs): Promise<number> {
  const what = args.positional[1];
  switch (what) {
    case "plugins": return publishPlugins(args);
    default:
      // A KĀHULI TIER NAMED HERE READS AS A MISROUTE, NEVER AS A TYPO. `engine` and `grammar` are real —
      // they simply belong to the door that ratchets, so the refusal points rather than shrugs.
      return refuseUsage(args, "nexus publish", PUBLISH_USAGE,
        what === undefined
          ? "name what to publish"
          : (what === "engine" || what === "grammar")
            ? `"${what}" names a KĀHULI ratchet tier, never an offering — it rides \`lares nexus kahuli ${what}\``
            : `unknown publishable "${what}"`);
  }
}
