/**
 * `lares export <dest> [--accept-omissions]` — the command face of `carryExport` (`./carry.ts`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";
import { carryExport, carryRefusal, LIVE_CARRY_DOORS, type CarryDoors, type CarryExportResult } from "./carry.js";

export async function cmdExport(args: ParsedArgs, doors: CarryDoors = LIVE_CARRY_DOORS): Promise<number> {
  const dest = args.positional[0];
  if (!dest) { console.error("usage: lares export <dest> [--accept-omissions]"); return 2; }
  let result: CarryExportResult;
  try { result = await carryExport(dest, { acceptOmissions: args.flags["accept-omissions"] === true, doors }); }
  catch (e) { return carryRefusal(args, "export", e); }
  const m = result.manifest;
  emit(args, {
    ok: true,
    data: { dest: result.dest, bundleId: m.bundleId, faces: m.faces.map((f) => f.petname), counts: m.counts, tempBytes: m.tempBytes, omissions: m.omissions },
    human: () => {
      console.log(`export: bundle ${m.bundleId.slice(0, 16)} written to ${result.dest} and read back whole`);
      console.log(`  faces: ${m.faces.map((f) => f.petname).join(", ") || "(none)"}`);
      for (const [layer, n] of Object.entries(m.counts)) if (n > 0) console.log(`  ${layer.padEnd(14)} ${n}`);
      for (const o of m.omissions) console.log(`  left behind: ${o.kind}${o.count !== undefined ? ` (${o.count})` : ""} — ${o.detail}`);
    },
  });
  return 0;
}
