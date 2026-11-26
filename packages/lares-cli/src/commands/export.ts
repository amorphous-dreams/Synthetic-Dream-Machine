/**
 * `lares export <dest> [--accept-omissions]` — the command face of `houseExport` (`./house-bundle.ts`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";
import { helpLines } from "../command-help.js";
import { houseExport, bundleRefusal, LIVE_BUNDLE_DOORS, type BundleDoors, type HouseExportResult } from "./house-bundle.js";

export async function cmdExport(args: ParsedArgs, doors: BundleDoors = LIVE_BUNDLE_DOORS): Promise<number> {
  const dest = args.positional[0];
  if (!dest) { for (const line of helpLines("export")) console.error(line); return 2; }
  let result: HouseExportResult;
  try { result = await houseExport(dest, { acceptOmissions: args.flags["accept-omissions"] === true, doors }); }
  catch (e) { return bundleRefusal(args, "export", e); }
  const m = result.manifest;
  emit(args, {
    ok: true,
    data: { dest: result.dest, bundleId: m.bundleId, faces: m.faces.map((f) => f.petname), counts: m.counts, tempBytes: m.tempBytes, omissions: m.omissions, unreadFaces: result.unreadFaces },
    human: () => {
      console.log(`export: bundle ${m.bundleId.slice(0, 16)} written to ${result.dest} and read back whole`);
      console.log(`  faces: ${m.faces.map((f) => f.petname).join(", ") || "(none)"}`);
      for (const [layer, n] of Object.entries(m.counts)) if (n > 0) console.log(`  ${layer.padEnd(14)} ${n}`);
      for (const o of m.omissions) console.log(`  left behind: ${o.kind}${o.count !== undefined ? ` (${o.count})` : ""} — ${o.detail}`);
      if (result.unreadFaces.length > 0) console.log(`    standing heads left behind for ${result.unreadFaces.map((i) => `h${i}`).join(", ")} (this terminal alone names them)`);
      // THE BUNDLE IS CLEARTEXT: private memory copied as plain files. Say so last, where a person reads before moving it.
      console.log(`export: the bundle at ${result.dest} rests unencrypted (private memory as plain files); keep it on a disk only you hold, and remove it once imported`);
    },
  });
  return 0;
}
