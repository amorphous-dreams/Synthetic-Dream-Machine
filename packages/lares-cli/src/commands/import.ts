/**
 * `lares import <dest> [--apply]` — the command face of `houseImport` (`./house-bundle.ts`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor } from "../render.js";
import { houseImport, bundleRefusal, unlockItLine, LIVE_BUNDLE_DOORS, type BundleDoors, type HouseImportResult } from "./house-bundle.js";

export async function cmdImport(args: ParsedArgs, doors: BundleDoors = LIVE_BUNDLE_DOORS): Promise<number> {
  const src = args.positional[0];
  if (!src) { console.error("usage: lares import <dest> [--apply]"); return 2; }
  let result: HouseImportResult;
  try { result = await houseImport(src, { apply: args.flags["apply"] === true, doors }); }
  catch (e) { return bundleRefusal(args, "import", e); }
  const all = Object.values(result.tallies);
  const refused = all.reduce((n, t) => n + t.refused.length, 0), stood = all.reduce((n, t) => n + t.stoodOff.length, 0);
  const code = refused > 0 ? exitFor("verb-error") : stood > 0 ? exitFor("conflict") : 0;
  emit(args, {
    ok: code === 0,
    data: { bundleId: result.bundleId, applied: result.applied, faceMap: result.faceMap, redeclare: result.redeclare, minted: result.minted, tallies: result.tallies, skipped: result.skipped, ashes: result.ashes, ashesLeft: result.ashesLeft, waiting: result.waiting, warnings: result.warnings, benchWaiting: result.benchWaiting, personalWaiting: result.personalWaiting, kahuaWaiting: result.kahuaWaiting, daemonWaiting: result.daemonWaiting, shares: result.shares },
    ...(refused > 0 ? { error: { code: "verb-error", message: `${refused} row(s) refused` } } : stood > 0 ? { error: { code: "conflict", message: `${stood} row(s) stand off; nothing overwrote them` } } : {}),
    human: () => {
      console.log(`import: bundle ${result.bundleId.slice(0, 16)} verified whole${result.applied ? "" : " · preview only (pass --apply)"}`);
      for (const w of result.warnings) console.error(`  warning: ${w}`);
      for (const [pet, i] of Object.entries(result.faceMap)) console.log(`  face "${pet}" -> h${i}`);
      for (const a of result.redeclare) console.log(`  re-declare ${a}`);
      for (const w of result.waiting) console.log(`  ${unlockItLine(w, "import")}; nothing of its memory laid into any layer`);
      for (const w of result.benchWaiting) console.log(w.why === "owner"
        ? `  the wiki ${w.slug} re-stands at its owner's wear: wear ${w.owner} (\`lares vault unlock --face N\`) and import again; nothing of it minted or landed under this face`
        : `  the workbench of ${w.slug} lands once, at the wear of a face that holds a writer's seat there: this face holds none, so its rows wait and nothing of them landed in this face's layers`);
      for (const w of result.personalWaiting) console.log(w.wiki !== undefined
        ? `  ${w.petname}'s margin of ${w.wiki} lands once the wiki stands: wear ${w.owner ?? "its owner"} (\`lares vault unlock --face N\`) and import again, then import at h${w.handleIndex}'s wear; nothing of it landed`
        : `  ${w.petname} stands unworn, and a face's personal layer of a wiki lands at that face's own wear: \`lares vault unlock --face ${w.handleIndex}\`, then import again`);
      for (const w of result.daemonWaiting) console.log(`  ${w.petname} stands open, and its own daemon layer lands at its own face's wear: \`lares vault unlock --face ${w.handleIndex}\`, then import again`);
      for (const w of result.kahuaWaiting) console.log(`  ${w.petname} stands unworn, and its ${w.heads} kahua head(s) lift at its own face's wear: \`lares vault unlock --face ${w.handleIndex}\`, then import again`);
      if (result.shares.written.length > 0) console.log(`  shares: ${result.applied ? "wrote" : "would write"} the row(s) for ${result.shares.written.join(", ")} into config/share.tid${result.shares.landed ? ", and landed the shares again" : ""}`);
      for (const b of result.minted) console.log(`  ${result.applied ? "minted" : "would mint"} ${b} (this vessel held no such wiki)`);
      for (const [cls, t] of Object.entries(result.tallies)) {
        if (t.landed + t.already + t.planned + t.waiting + t.stoodOff.length + t.refused.length === 0) continue;
        console.log(`  ${cls.padEnd(8)} ${result.applied ? `landed ${t.landed}` : `would land ${t.planned}`} · already ${t.already}${t.waiting > 0 ? ` · waiting ${t.waiting}` : ""} · stood off ${t.stoodOff.length} · refused ${t.refused.length}`);
        for (const s of t.stoodOff) console.error(`    stands off: ${s}`);
        for (const r of t.refused) console.error(`    refused: ${r}`);
      }
      for (const s of result.skipped) console.error(`  skipped (no address derives): ${s}`);
      for (const a of result.ashes) { console.log(`  ashes: the former face ${a.relation}'s folders move out of the live mirror set:`); for (const m of a.moved) console.log(`    ${m}`); }
      for (const a of result.ashesLeft) console.log(`  ashes: the former face ${a.relation}'s folders stay where they stand: ${a.why}`);
    },
  });
  return code;
}
