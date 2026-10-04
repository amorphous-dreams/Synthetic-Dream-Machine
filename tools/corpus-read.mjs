// corpus-read — read a carrier the enumeration named, tolerating one that left between the two.
//
// THE WALK AND THE READ ARE TWO MOMENTS. `carrierFiles` enumerates from `git ls-files` and reads each
// candidate under its own try/catch, so the list it returns holds only files that read cleanly AT THAT
// INSTANT. Every consumer then re-reads those paths — and on a tree another agent is committing to, a
// path can be gone by the second read. An unguarded `readFileSync` there throws ENOENT and takes the
// whole witness down.
//
// A WITNESS THAT CRASHES REPORTS RED FOR A REASON THAT IS NOT ABOUT THE CORPUS. That is the instrument
// lying: the operator reads a failing gate and goes looking for a malformed carrier that does not exist.
// Measured 2026-09-12: `frame-shape` died on `bags/lares-history/.../AUTH-ATPROTO.mem` mid-run and passed
// clean seconds later, the corpus never having held a fault.
//
// SKIPPING IS NOT ENOUGH — a silent skip trades a false red for a false green, and a gate that quietly
// stops checking N carriers is worse than one that crashes. So the skip is COUNTED, and every summary
// line says so when the count is non-zero. The honest reading is "I checked 733 of 734; one left the
// tree while I walked it."
import { readFileSync, existsSync } from "fs";
import { join } from "path";

let vanished = 0;

/** A carrier's text, or `null` when it left the tree between the enumeration and this read. */
export function readCarrier(repo, rel) {
  try {
    return readFileSync(join(repo, rel), "utf8");
  } catch {
    vanished++;
    return null;
  }
}

/** How many carriers left the tree mid-walk. Zero on any quiet tree. */
export function vanishedCount() {
  return vanished;
}

/** ` · N left the tree mid-walk` for a summary line, or the empty string when none did. */
export function vanishedNote() {
  return vanished === 0 ? "" : ` · ${vanished} left the tree mid-walk (a parallel commit; re-run to check them)`;
}

// ---------------------------------------------------------------------------
// Dist-shore boot — eleven tools repeated this existsSync-then-import block by hand, each phrasing
// the cure line itself; one drifted the moment a twelfth was added with a typo in the package name.
// ---------------------------------------------------------------------------

/**
 * THE ONE FINDER of the corpus, loaded from the built shore. A hardcoded glob answers a question
 * about PATHS; the law asks about DECLARATIONS, and the two disagreed on the runtime kernel face for
 * three rulings — so every witness walks from here, never from its own `find`/glob.
 *
 * Exits loudly (2), naming the exact cure, when the dist a caller needs has never been built — the
 * absence NAMES its cure rather than reading clean over an unbuilt tree.
 */
export async function distCarrierFiles(repo, toolName) {
  const distCarriers = join(repo, "packages/lararium-tw5/dist/carrier-files.js");
  if (!existsSync(distCarriers)) {
    console.error(`[${toolName}] no built shore at ${distCarriers}\n  cure: pnpm --filter @lararium/tw5 build`);
    process.exit(2);
  }
  return import(distCarriers);
}

/**
 * Any other built module beneath `dist` (or an absolute path, e.g. the frame package's shore) a tool
 * needs before it can run — same loud exit, same cure line, so a witness that forgets to build one
 * dependency reads the same way whichever dependency it forgot.
 */
export async function distModule(dist, relOrAbs, toolName, cure = "pnpm --filter @lararium/tw5 build") {
  const at = relOrAbs.startsWith("/") ? relOrAbs : join(dist, relOrAbs);
  if (!existsSync(at)) {
    console.error(`[${toolName}] no built shore at ${at}\n  cure: ${cure}`);
    process.exit(2);
  }
  return import(at);
}

/**
 * Boots a vanilla TW5 engine from the built shore — the oracle three witnesses (head-parity,
 * sigil-parity, quote-positionals) each booted by hand, identically. Holds no grammar on purpose: its
 * wiki serves as the parse ORACLE these witnesses measure their own reading against.
 */
export async function bootTW5Engine(dist, toolName) {
  const { TW5Engine } = await distModule(dist, "tw5-vm.js", toolName);
  const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await distModule(dist, "generated-tw5-version.js", toolName);
  const core = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
  if (!existsSync(core)) {
    console.error(`[${toolName}] no TW5 core blob at ${core}\n  cure: pnpm --filter @lararium/tw5 build:tw5-vendor`);
    process.exit(2);
  }
  const engine = new TW5Engine();
  await engine.boot(new Uint8Array(readFileSync(core)));
  const wiki = engine.wiki ?? engine._tw?.wiki;
  return { engine, wiki };
}
