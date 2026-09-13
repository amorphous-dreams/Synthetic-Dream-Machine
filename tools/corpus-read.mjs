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
import { readFileSync } from "fs";
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
