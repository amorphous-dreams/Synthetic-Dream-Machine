/**
 * `lares nexus release <manifest-file> --approval <file> [--nexus <aid>]` — publish the Nexus's FLOOR RELEASE: the one
 * porch body naming the floor manifest the Kahu cabal released. A seat held in this vault seals it as the steward, the
 * seats' approval of the manifest file's exact bytes rides attached, and the release lands on the Nexus's publication
 * board once it counts (w26-floor-lane#/the-slices).
 *
 * The approval comes first, from the doors that already carry one between vaults:
 *
 *   lares nexus promote open <manifest-file> --purpose floor-release --surface floor-release --class high-impact --out a.json
 *   lares nexus promote sign a.json --confirm-statement <digest> --out a.json        (each further vault)
 *   lares nexus release <manifest-file> --approval a.json
 *
 * The verb rides the store door (`nexus-release`), so a standing vessel's own Repo takes the write and a bare tree
 * holds the store for the moment of the act. A release that counts nothing (a short approval, other bytes, a chain
 * left unsettled) lands nothing and says why. A herm carries the answer and signs none.
 *
 * `--cut` CUTS the manifest first, from live house canon (offering#/the-canon-offer): the floor a release after a promotion
 * names, written to <manifest-file> and staged in this hearth's CAS. It lands nothing; the approval and the release follow on
 * that file. `lares nexus release <manifest-file> --cut` → `nexus promote open|sign` → `nexus release <manifest-file> --approval`.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FloorRefused, NexusCabalError, type FloorCutResult, type NexusReleaseResult } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { storeVerb, storeFailure } from "../store-door.js";
import type { ParsedArgs } from "../parse-args.js";

export async function cmdNexusRelease(args: ParsedArgs): Promise<number> {
  const file = args.positional[1], approvalPath = args.options["approval"];
  const aid = args.options["nexus"];
  if (file && args.flags["cut"] === true) return cutRelease(args, resolve(file), aid);
  if (!file || !approvalPath) return refuseUsage(args, "nexus", helpLines("nexus"), "release needs <manifest-file> and --approval <file> (or --cut to cut that file from live canon)");
  try {
    let approval: unknown;
    try { approval = JSON.parse(readFileSync(approvalPath, "utf8")); }
    catch { throw new NexusCabalError(`cannot read ${approvalPath} as an approval file`); }
    const { output } = await storeVerb("nexus-release", { manifestFile: resolve(file), approval, ...(aid !== undefined ? { aid } : {}) }, NexusCabalError);
    const r = output as unknown as NexusReleaseResult;
    emit(args, {
      ok: true, data: { ...r },
      human: () => {
        console.log(`nexus release → LANDED ${r.release.cid}`);
        console.log(`  nexus:    ${r.nexus}`);
        console.log(`  epoch:    ${r.release.body.epoch}`);
        console.log(`  prior:    ${r.release.body.prior ?? "(the Nexus's first release)"}`);
        console.log(`  manifest: ${r.release.body.manifest}`);
        console.log(`  approval: ${r.counted} of ${r.threshold} seats over the manifest's exact bytes`);
        console.log("  the release rests on this Nexus's publication board; each vessel accepts it by its own act (lares vessel floor accept)");
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusCabalError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus release: ${msg}`) });
    return exitFor(failure.code);
  }
}

/** `--cut`: the floor-cut row, then the next steps named. */
async function cutRelease(args: ParsedArgs, out: string, aid: string | undefined): Promise<number> {
  try {
    const { output } = await storeVerb("floor-cut", { out, ...(aid !== undefined ? { aid } : {}) }, NexusCabalError);
    if (typeof output["refused"] === "string") throw new FloorRefused(String(output["refusal"] ?? "floor-cut-refused"), output["refused"]);
    const r = output as unknown as FloorCutResult;
    emit(args, {
      ok: true, data: { ...r },
      human: () => {
        console.log(`nexus release --cut → CUT ${r.manifestCid}${r.manifestCid === r.prior ? " (canon unmoved: the prior floor)" : ""}`);
        console.log(`  prior:  ${r.prior}`);
        console.log(`  moved:  ${r.moved.join(", ") || "(none)"}   cut: ${r.cut.join(", ")}${r.kept.length ? `   kept (no live canon here): ${r.kept.join(", ")}` : ""}`);
        console.log(`  wrote ${r.out}; the floor stands whole in this hearth's CAS. Next:`);
        console.log(`    lares nexus promote open ${r.out} --purpose floor-release --surface floor-release --class high-impact --out a.json`);
        console.log(`    lares nexus release ${r.out} --approval a.json`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof FloorRefused ? err.refusal : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus release --cut: ${msg}`) });
    return exitFor(failure.code);
  }
}
