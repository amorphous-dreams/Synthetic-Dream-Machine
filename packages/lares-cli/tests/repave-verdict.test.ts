/**
 * repave-verdict — whether a finished re-pave may be trusted, read off counts rather than exit codes.
 *
 * ── WHY A GREEN EXIT IS NOT A VERDICT ───────────────────────────────────────────────────────────
 * Every leg of a re-pave can return 0 while the sensorium stays empty: a sweep that discovered no
 * sources exits clean, a bearing pass over zero drawers stamps nothing and reports success, and a
 * projection re-derived from an empty plane is honestly empty. The rite therefore asks for counts
 * against SOURCE counts before any instrument reads the result — because an instrument answering
 * over an unfed plane and one answering over a broken door look identical.
 *
 * ── THE THREE ENDINGS ───────────────────────────────────────────────────────────────────────────
 * LANDED   sources stood and drawers grew — the pass did its work.
 * EMPTY    no sources stood at all. Honest, and not a fault: a fresh machine has nothing to pour.
 * BARREN   sources stood and nothing landed. This is the one that must never read as success.
 *
 * A pass that landed FEWER drawers than it started with is not counted a win either: a re-pave that
 * shrinks the corpus has lost something the sources still hold.
 */
import { describe, it, expect } from "vitest";
import { repaveVerdict } from "../src/commands/capture/harvest.js";

describe("repave-verdict — counts, against the sources they came from", () => {




  it("an idempotent re-run that landed nothing NEW still stands", () => {
    // Everything was already landed. The count did not move, and that is the verb working.
    const v = repaveVerdict({ sources: 1030, before: 40299, after: 40299 });
    expect(v.ok).toBe(true);
    expect(v.state).toBe("landed");
  });

  it("★ every verdict says enough to act on ★", () => {
    for (const args of [{ sources: 5, before: 0, after: 0 }, { sources: 0, before: 0, after: 0 },
                        { sources: 5, before: 9, after: 1 }, { sources: 5, before: 0, after: 9 }]) {
      expect(repaveVerdict(args).why.length).toBeGreaterThan(20);
    }
  });
});
