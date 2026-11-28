/**
 * nexus-publish — THE OFFERING DOOR: what THIS operator publishes for others to take.
 *
 * ── WHY IT STANDS APART FROM `kahuli` ────────────────────────────────────────────────────────────
 * `kahuli` overturns what the MESH must agree on: `engineCid` (the engine CID, signed into every
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
 *
 * ── UNDER A PŪLAMA THE HAND SIGNS AT THE PŪLAMA'S HAND DOOR ──────────────────────────────────────
 * The vessel under a pūlama holds no face root, so `apply=true` there finds no ward to open. The signing runs in the lei
 * pattern, and the host shim walks it for `--apply` (`tools/lares-container.sh nexus publish plugins …`): `--terms` prints
 * ONE stdout line (the face and the CLOSED descriptor the root signs: offeror, pluginsCid, blobs), signing nothing and asking
 * no route; the pūlama's `publish '<terms>'` reads the route on the operator's terminal and its face root signs that one
 * descriptor; `land='<answer>'` lands the signed offering, where the vessel derives the descriptor afresh from the same
 * source and announces it only over a byte-equal signed preimage.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NexusPublishError, type NexusPublishPluginsResult, type NexusPublishTerms } from "@lararium/node";
import { computePluginsCid } from "@lararium/mesh/genesis-doc";
import { storeVerb, storeFailure } from "../store-door.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/** What this door may publish today. A new cap lands here beside `plugins`. */
export const PUBLISHABLE = ["plugins"] as const;

const PUBLISH_USAGE: readonly string[] = [
  "usage: lares nexus publish plugins source=<dir> [face=N] [apply=true | terms=true | land='<pūlama answer>']",
  "",
  "  THE OFFERING DOOR — what THIS operator publishes for others to take. Held apart from",
  "  `nexus kahuli`, which overturns what the MESH must agree on (engine · grammar).",
  "",
  "    plugins  a LOCAL offering source (never genesis): <dir>/offering.json plus each blob's",
  "             bytes beside it, either a signed gift (kept exactly as signed) or an unsigned",
  "             descriptor this persona signs fresh, as PUBLISHER.",
  "",
  "  source=   the offering source directory (required).",
  "  apply=true    sign the offering (when unsigned) + announce it on the Nexus's publication board.",
  "  terms=true    (under a pūlama) print ONE line: the face and the descriptor the pūlama's hand signs",
  "             (`pulama-main.js publish '<terms>'`); signs nothing, asks no route.",
  "  land=     land the offering the pūlama's hand signed over this source's own descriptor.",
];

/** One pūlama `publish` answer's signed offering and the face it signed for; a refusal or another act lands nothing. */
export function publishLanding(raw: string, named: number | undefined): { readonly offering: Record<string, unknown>; readonly face: number } | { readonly usage: string } {
  let read: unknown;
  try { read = JSON.parse(raw); } catch { return { usage: "land='s answer reads as no JSON" }; }
  if (typeof read !== "object" || read === null || Array.isArray(read)) return { usage: "land='s answer reads as no object" };
  const r = read as Record<string, unknown>;
  if (r["op"] !== "publish") return { usage: "land= takes the pūlama's publish answer" };
  if (r["reading"] !== "signed") return { usage: `the pūlama signed nothing (${String(r["reading"])}), so nothing lands` };
  const face = r["face"], offering = r["offering"];
  if (typeof face !== "number" || !Number.isSafeInteger(face) || face < 0 || typeof offering !== "object" || offering === null || Array.isArray(offering)) return { usage: "the pūlama's answer names no face and no signed offering" };
  if (named !== undefined && named !== face) return { usage: `the pūlama signed for h${face}, and the line names h${named}` };
  return { offering: offering as Record<string, unknown>, face };
}

/**
 * `lares nexus publish plugins source=<dir>` — READ a local offering source.
 *
 * The read names the region a FRESH fold of `<dir>`'s blobs would carry, and the blobs themselves. A
 * read never bakes, signs, or touches bytes on disk beyond `<dir>` itself — it reports what `apply=true`
 * WOULD announce, never genesis's own region (H3: genesis carries the boot set alone and names no
 * registry of what an operator may offer).
 */
async function publishPlugins(args: ParsedArgs): Promise<number> {
  const source = args.options["source"];
  if (!source) return refuseUsage(args, "nexus publish", PUBLISH_USAGE, "publishing plugins needs source=<dir>");

  const rawFace = args.options["face"];
  const named = typeof rawFace === "string" ? (/^(?:0|[1-9][0-9]*)$/.test(rawFace.trim()) ? Number(rawFace.trim()) : NaN) : undefined;
  if (named !== undefined && !Number.isSafeInteger(named)) return refuseUsage(args, "nexus publish", PUBLISH_USAGE, "face= takes a whole count from 0");
  const land = args.options["land"];
  const modes = [args.flags["apply"] === true, args.flags["terms"] === true, typeof land === "string"].filter(Boolean).length;
  if (modes > 1) return refuseUsage(args, "nexus publish", PUBLISH_USAGE, "name one of apply=true, terms=true or land=");

  // THE TERMS LINE (under a pūlama): exactly one stdout line, the terms `pulama-main.js publish` takes, unless `--json` asks the envelope.
  if (args.flags["terms"] === true) {
    const line: ParsedArgs = { ...args, flags: { ...args.flags, json: args.flags["json"] === true } };
    try {
      const terms = (await storeVerb("nexus-publish", { source, terms: true, ...(named !== undefined ? { handleIndex: named } : {}) }, NexusPublishError)).output as unknown as NexusPublishTerms;
      const out = { face: terms.face, offering: terms.offering };
      emit(line, { ok: true, data: out, human: () => console.log(JSON.stringify(out)) });
      return 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failure = storeFailure(err, err instanceof NexusPublishError ? "refused" : "error");
      emit(line, { ok: false, error: failure, human: () => console.error(`lares nexus publish plugins: ${message}`) });
      return exitFor(failure.code);
    }
  }

  let landing: { readonly offering: Record<string, unknown>; readonly face: number } | null = null;
  if (typeof land === "string") {
    const read = publishLanding(land, named);
    if ("usage" in read) return refuseUsage(args, "nexus publish", PUBLISH_USAGE, read.usage);
    landing = read;
  }

  if (args.flags["apply"] || landing !== null) {
    try {
      const rowArgs = landing !== null
        ? { source, handleIndex: landing.face, signed: landing.offering }
        : { source, ...(named !== undefined ? { handleIndex: named } : {}) };
      const result = (await storeVerb("nexus-publish", rowArgs, NexusPublishError)).output as unknown as NexusPublishPluginsResult;
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
  // fresh — the SAME fold `apply=true` would sign, so a read never drifts from what applying would do.
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
