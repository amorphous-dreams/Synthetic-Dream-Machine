/**
 * A STANDING STANDOFF RESTS ONCE.
 *
 * The live fire (vessel at develop 26268109b): four both-moved standoffs in `bags/lararium` logged `[confluence] projection
 * conflict` round after round under the SAME keys, ~100 lines a minute, each surfacing waking the stand-off keeper (drafts,
 * an alert, a git read of the base), until the island stopped answering. Each round the row left on one reading and came
 * back on the next, and every return spoke as a fresh standoff.
 *
 * The key folds the file's bytes, the records' render and the base they stand against. So:
 *   · a standoff that leaves on one reading and returns on the next under the same key raises nothing and clears nothing;
 *   · a standoff that comes back under a key it already surfaced re-seats as a standing row, silent;
 *   · a standoff whose file or records moved speaks again, under its new key;
 *   · a leave that two readings agree on resolves, once.
 *
 * The projector runs bare (no gate), so every reading here is one the test asks for.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { carrierHash } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lar:///ha.ka.ba/bags/lararium";
const URI = "lar:///ha.ka.ba/lararium/api/save-path";
const REL = `${URI.slice("lar:///".length)}${MEME_EXT}`;
const LAST = "title: records\n\nTHE LAST AGREEMENT\n";
const HAND = "title: records\n\nTHE FILE MOVED PAST IT\n";
const RECORDS = "title: records\n\nTHE RECORDS MOVED PAST IT\n";

function bare() {
  root = mkdtempSync(join(tmpdir(), "lar-rests-once-"));
  const file = join(root, REL);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, HAND, "utf-8");
  const tree = new SyncedTree(join(root, ".projection", "synced-tree"));
  tree.set(syncedTreeKey(BAG, URI), file, carrierHash(LAST));
  const view = { origin: BAG as string, body: RECORDS };
  const conflicts: string[] = [];
  const resolved: string[] = [];
  const lines: string[] = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: view.body, encoding: "utf8" }),
    syncedTree: tree,
    onConflict: (info) => { conflicts.push(info.standoff); },
    onConflictResolved: (info) => { resolved.push(info.standoff); },
  });
  // A bare projector reads its wiki through `_tw5` alone: no `start`, so no gate and no reading the test did not ask for.
  (projector as unknown as { _tw5: TW5Engine })._tw5 = { $tw: { wiki: {
    getTiddler: (title: string) => (title === URI ? { fields: { title, "$origin-bag": view.origin } } : undefined),
  } } } as unknown as TW5Engine;
  const read = (): Promise<void> => (projector as unknown as { reconcile: (u: string) => Promise<void> }).reconcile(URI);
  const err = console.error;
  console.error = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.includes("[confluence] projection conflict")) lines.push(s); else err(...a); };
  return { projector, view, conflicts, resolved, lines, file, read, restore: () => { console.error = err; } };
}

describe("a both-moved standoff that stays put rests once", () => {
  test("★ N readings that leave and find the same standoff again raise ONE conflict, ONE log line, and clear nothing ★", async () => {
    const s = bare();
    try {
      await s.read();
      expect(s.conflicts, "entering the standoff raises it").toHaveLength(1);
      const key = s.conflicts[0]!;
      for (let i = 0; i < 12; i++) {
        s.view.origin = "lar:///ha.ka.ba/wikis/lares/draft";   // one reading: the carrier projects elsewhere
        await s.read();
        s.view.origin = BAG;                                    // the next: the very same states stand again
        await s.read();
      }
      expect(s.conflicts, "the same key never speaks twice").toEqual([key]);
      expect(s.lines, "one log line across every reading").toHaveLength(1);
      expect(s.resolved, "a flicker clears no alert").toEqual([]);
      expect(s.projector.standing().map((r) => r.standoff), "the row stands").toEqual([key]);
    } finally { s.restore(); }
  });

  test("a leave two readings agree on resolves once; the same key returning later re-seats silent; a moved file speaks again", async () => {
    const s = bare();
    try {
      await s.read();
      const key = s.conflicts[0]!;
      s.view.origin = "lar:///ha.ka.ba/wikis/lares/draft";
      await s.read();
      expect(s.resolved, "one reading proves nothing yet").toEqual([]);
      expect(s.projector.standing(), "the row steps aside").toEqual([]);
      await s.read();
      expect(s.resolved, "the second reading resolves it").toEqual([key]);
      await s.read();
      expect(s.resolved, "and only once").toEqual([key]);

      s.view.origin = BAG;
      await s.read();
      expect(s.conflicts, "the states the key folded never moved: no second word").toEqual([key]);
      expect(s.projector.standing().map((r) => r.standoff), "the row stands again").toEqual([key]);

      writeFileSync(s.file, "title: records\n\nA HAND MOVED THE FILE AGAIN\n", "utf-8");
      await s.read();
      expect(s.conflicts, "the file moved: a new key speaks").toHaveLength(2);
      expect(s.conflicts[1]).not.toBe(key);
      expect(s.resolved, "the standoff it replaced clears").toEqual([key, key]);
    } finally { s.restore(); }
  });
});
