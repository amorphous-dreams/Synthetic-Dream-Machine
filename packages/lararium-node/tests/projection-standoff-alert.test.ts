/**
 * A PROJECTION STANDOFF SURFACES ONCE, BY ITS OWN KEY, AND ITS RESOLUTION CLEARS IT.
 *
 * A standoff names one carrier in one bag at one pair of states: the disk's hash and the records' hash.
 * The projector reconciles level-triggered, so it meets a standing standoff at every nudge. It raises
 * `onConflict` on ENTERING a standoff and stays quiet while that standoff stands; a standoff whose
 * states moved reads as a new one; and the reconcile that finds the standoff gone raises
 * `onConflictResolved` with the same key, once.
 *
 * Control: the write stands down at every reconcile of a standing standoff (the operator's bytes stay).
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { carrierHash } from "@lararium/mesh";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const URI_A = "lar:///ha.ka.ba/probe/carrier-a";
const URI_B = "lar:///ha.ka.ba/probe/carrier-b";
const relOf = (uri: string): string => `${uri.slice("lar:///".length)}.mem`;
const RECORDS = "title: records\n\nWHAT THE RECORDS SAY\n";
const LAST = "title: records\n\nTHE LAST PROJECTION\n";

type Conflict = { bagId: string; uri: string; reason: string; standoff: string };

function stand(): {
  projector: LarDiskProjector; stop: () => Promise<void>; conflicts: Conflict[]; resolved: Array<{ bagId: string; uri: string; standoff: string }>;
  disk: (uri: string, body: string) => void; read: (uri: string) => string; reconcile: (uri: string) => Promise<void>;
} {
  root = mkdtempSync(join(tmpdir(), "lar-standoff-"));
  const tree = new SyncedTree(join(root, ".projection", "synced-tree.json"), 0);
  const disk = (uri: string, body: string): void => { const abs = join(root, relOf(uri)); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body, "utf-8"); };
  for (const uri of [URI_A, URI_B]) { disk(uri, `title: records\n\nA HAND ON DISK for ${uri}\n`); tree.set(syncedTreeKey(BAG, uri), carrierHash(LAST)); }
  const conflicts: Conflict[] = [];
  const resolved: Array<{ bagId: string; uri: string; standoff: string }> = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: RECORDS, encoding: "utf8" }),
    syncedTree: tree,
    onConflict: (info) => { conflicts.push(info as Conflict); },
    onConflictResolved: (info) => { resolved.push(info); },
  });
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (title === URI_A || title === URI_B ? { fields: { title, "$origin-bag": BAG } } : undefined),
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  const stop = projector.start(engine);
  const reconcile = (uri: string): Promise<void> => (projector as unknown as { reconcile: (u: string) => Promise<void> }).reconcile(uri);
  return { projector, stop, conflicts, resolved, disk, read: (uri) => readFileSync(join(root, relOf(uri)), "utf-8"), reconcile };
}

describe("a projection standoff surfaces once, by its key", () => {
  test("ten reconciles of one standoff raise one conflict; the operator's bytes stand at every one", async () => {
    const s = stand();
    const before = s.read(URI_A);
    await s.reconcile(URI_A);
    expect(s.conflicts, "entering the standoff raises it").toHaveLength(1);
    for (let i = 0; i < 10; i++) await s.reconcile(URI_A);
    // Ten more reconciles of the same states add nothing.
    expect(s.conflicts).toHaveLength(1);
    expect(s.read(URI_A), "CONTROL: the write stood down every time").toBe(before);
    await s.stop();
  });

  test("two carriers standing off raise two conflicts under two keys", async () => {
    const s = stand();
    await s.reconcile(URI_A);
    await s.reconcile(URI_B);
    expect(s.conflicts.map((c) => c.uri).sort()).toEqual([URI_A, URI_B]);
    const keys = s.conflicts.map((c) => c.standoff);
    expect(new Set(keys).size).toBe(2);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f]{16,}$/);
    await s.stop();
  });

  test("a standoff whose disk state moved reads as a new standoff; its resolution clears the latest key once", async () => {
    const s = stand();
    await s.reconcile(URI_A);
    await s.reconcile(URI_B);
    const first = s.conflicts.find((c) => c.uri === URI_A)!.standoff;

    s.disk(URI_A, "title: records\n\nA SECOND HAND ON DISK\n");
    await s.reconcile(URI_A);
    await s.reconcile(URI_A);
    const mine = s.conflicts.filter((c) => c.uri === URI_A);
    expect(mine).toHaveLength(2);
    const second = mine[1]!.standoff;
    expect(second).not.toBe(first);
    expect(s.resolved, "moving from one standoff into another resolves nothing").toEqual([]);

    // The operator settles it: the disk now says what the records say.
    s.disk(URI_A, RECORDS);
    await s.reconcile(URI_A);
    await s.reconcile(URI_A);
    expect(s.resolved).toEqual([{ bagId: BAG, uri: URI_A, standoff: second }]);
    // CONTROL: the other carrier's standoff still stands, unresolved.
    expect(s.resolved.some((r) => r.uri === URI_B)).toBe(false);
    await s.stop();
  });
});
