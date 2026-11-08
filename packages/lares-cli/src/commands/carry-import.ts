/**
 * `lares import <dest> [--apply]` — the command face of `carryImport` (`./carry.ts`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor } from "../render.js";
import { carryImport, carryRefusal, LIVE_CARRY_DOORS, type CarryDoors, type CarryImportResult } from "./carry.js";

export async function cmdImport(args: ParsedArgs, doors: CarryDoors = LIVE_CARRY_DOORS): Promise<number> {
  const src = args.positional[0];
  if (!src) { console.error("usage: lares import <dest> [--apply]"); return 2; }
  let result: CarryImportResult;
  try { result = await carryImport(src, { apply: args.flags["apply"] === true, doors }); }
  catch (e) { return carryRefusal(args, "import", e); }
  const all = Object.values(result.tallies);
  const refused = all.reduce((n, t) => n + t.refused.length, 0), stood = all.reduce((n, t) => n + t.stoodOff.length, 0);
  const code = refused > 0 ? exitFor("verb-error") : stood > 0 ? exitFor("conflict") : 0;
  emit(args, {
    ok: code === 0,
    data: { bundleId: result.bundleId, applied: result.applied, faceMap: result.faceMap, redeclare: result.redeclare, tallies: result.tallies, skipped: result.skipped },
    ...(refused > 0 ? { error: { code: "verb-error", message: `${refused} row(s) refused` } } : stood > 0 ? { error: { code: "conflict", message: `${stood} row(s) stand off; nothing overwrote them` } } : {}),
    human: () => {
      console.log(`import: bundle ${result.bundleId.slice(0, 16)} verified whole${result.applied ? "" : " · preview only (pass --apply)"}`);
      for (const [pet, i] of Object.entries(result.faceMap)) console.log(`  face "${pet}" -> h${i}`);
      for (const a of result.redeclare) console.log(`  re-declare ${a}`);
      for (const [cls, t] of Object.entries(result.tallies)) {
        if (t.landed + t.already + t.planned + t.stoodOff.length + t.refused.length === 0) continue;
        console.log(`  ${cls.padEnd(8)} ${result.applied ? `landed ${t.landed}` : `would land ${t.planned}`} · already ${t.already} · stood off ${t.stoodOff.length} · refused ${t.refused.length}`);
        for (const s of t.stoodOff) console.error(`    stands off: ${s}`);
        for (const r of t.refused) console.error(`    refused: ${r}`);
      }
      for (const s of result.skipped) console.error(`  skipped (no address derives): ${s}`);
    },
  });
  return code;
}
