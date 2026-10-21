/**
 * `lares nexus release <manifest-file> --approval <file> [--nexus <aid>]` — publish the Nexus's FLOOR RELEASE: the one
 * porch body naming the floor manifest the Kahu cabal released. A seat held in this vault seals it as the steward, the
 * seats' approval of the manifest file's exact bytes rides attached, and the release lands on the Nexus's crossroads
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
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NexusCabalError, type NexusReleaseResult } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { storeVerb, storeFailure } from "../store-door.js";
import type { ParsedArgs } from "../parse-args.js";

export async function cmdNexusRelease(args: ParsedArgs): Promise<number> {
  const file = args.positional[1], approvalPath = args.options["approval"];
  if (!file || !approvalPath) return refuseUsage(args, "nexus", helpLines("nexus"), "release needs <manifest-file> and --approval <file>");
  const aid = args.options["nexus"];
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
        console.log("  the release rests on this Nexus's crossroads board; a face accepts it by its own act");
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
