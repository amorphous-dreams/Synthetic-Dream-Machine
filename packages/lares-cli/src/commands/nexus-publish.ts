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

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NexusPublishError, type NexusPublishPluginsResult } from "@lararium/node";
import { computePluginsCid } from "@lararium/mesh";
import { storeVerb, storeFailure } from "../store-door.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/** What this door may publish today. A new cap lands here beside `plugins`. */
export const PUBLISHABLE = ["plugins"] as const;

const PUBLISH_USAGE: readonly string[] = [
  "usage: lares nexus publish plugins --source <dir> [--apply]",
  "",
  "  THE OFFERING DOOR — what THIS operator publishes for others to take. Held apart from",
  "  `nexus kahuli`, which overturns what the MESH must agree on (engine · grammar).",
  "",
  "    plugins  a LOCAL offering source (never genesis): <dir>/offering.json plus each blob's",
  "             bytes beside it, either a signed gift (kept exactly as signed) or an unsigned",
  "             descriptor this persona signs fresh, as PUBLISHER.",
  "",
  "  --source   the offering source directory (required).",
  "  --apply    sign the offering (when unsigned) + announce it on the crossroads plane.",
];

/**
 * `lares nexus publish plugins --source <dir>` — READ a local offering source.
 *
 * The read names the region a FRESH fold of `<dir>`'s blobs would carry, and the blobs themselves. A
 * read never bakes, signs, or touches bytes on disk beyond `<dir>` itself — it reports what `--apply`
 * WOULD announce, never genesis's own region (H3: genesis carries the boot set alone since the Streams
 * retirement, and was never a registry of what an operator may offer).
 */
async function publishPlugins(args: ParsedArgs): Promise<number> {
  const source = args.options["source"];
  if (!source) return refuseUsage(args, "nexus publish", PUBLISH_USAGE, "publishing plugins needs --source <dir>");

  if (args.flags["apply"]) {
    try {
      const result = (await storeVerb("nexus-publish", { source, ...(typeof args.options["face"] === "string" ? { handleIndex: Number(args.options["face"]) } : {}) }, NexusPublishError)).output as unknown as NexusPublishPluginsResult;
      emit(args, {
        ok: true,
        data: {
          offeringCid: result.offeringCid,
          boardUrl: result.boardUrl,
          offeror: result.offeror,
          pluginsCid: result.pluginsCid,
          blobCount: result.blobCount,
        },
        human: () => {
          console.log("nexus publish plugins — IMMUTABLE OFFERING ANNOUNCED:");
          console.log(`  offering: ${result.offeringCid}`);
          console.log(`  board:    ${result.boardUrl}`);
          console.log(`  offeror:  ${result.offeror}`);
          console.log(`  plugins:  ${result.pluginsCid} · ${result.blobCount} blob(s)`);
          console.log("  the gift changed no grammar and installed no bytes");
        },
      });
      return 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failure = storeFailure(err, err instanceof NexusPublishError ? "refused" : "error");
      emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus publish plugins: ${message}`) });
      return exitFor(failure.code);
    }
  }

  const descriptorPath = resolve(source, "offering.json");
  if (!existsSync(descriptorPath)) {
    emit(args, {
      ok: false, error: { code: "usage", message: `no offering source at ${descriptorPath}` },
      human: () => console.error(`lares nexus publish plugins: no offering source at ${descriptorPath}`),
    });
    return exitFor("usage");
  }
  const parsed = JSON.parse(readFileSync(descriptorPath, "utf8")) as { blobs?: readonly { id: string; version: string; sha256: string }[]; sig?: string; pluginsCid?: string };
  const blobs = parsed.blobs ?? [];
  // A SIGNED gift already carries its own declared region; an unsigned descriptor's fold is computed
  // fresh — the SAME fold `--apply` would sign, so a read never drifts from what applying would do.
  const pluginsCid = typeof parsed.sig === "string" && typeof parsed.pluginsCid === "string" ? parsed.pluginsCid : computePluginsCid(blobs);

  // L-d: this read routes through the ONE choke point every other door answers through, so `--json`
  // (or any non-TTY caller) reads structured data, never the human prose.
  emit(args, {
    ok: true,
    data: {
      source: resolve(source),
      pluginsCid,
      blobCount: blobs.length,
      blobs: blobs.map((b) => ({ id: b.id, version: b.version, sha256: b.sha256 })),
    },
    human: () => {
      console.log(`nexus publish plugins — a LOCAL offering source (a read; nothing signed, nothing announced):`);
      console.log(`  source:               ${resolve(source)}`);
      console.log(`  plugins (pluginsCid): ${pluginsCid}   a region, never a ratchet tier`);
      if (blobs.length > 0) {
        console.log(`  the source holds ${blobs.length}:`);
        for (const b of blobs) console.log(`    ${b.id}  v${b.version}  ${b.sha256}`);
      }
      console.log("");
      console.log("  a plugin added or dropped moves THIS region and no other — plugin drift never reads as");
      console.log("  grammar drift, and no peer's epoch moves when yours does.");
      console.log("  the ratchets the MESH shares live at `lares nexus kahuli <engine|grammar>`.");
    },
  });
  return 0;
}

/** `lares nexus publish <what>` — the tier-parameterized offering door. */
export async function cmdPublish(args: ParsedArgs): Promise<number> {
  const what = args.positional[1];
  switch (what) {
    case "plugins": return await publishPlugins(args);
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
