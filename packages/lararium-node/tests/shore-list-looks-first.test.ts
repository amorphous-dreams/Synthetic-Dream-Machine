/**
 * `lares shore` LOOKS AT THE DISK BEFORE IT LISTS.
 *
 * A person removes a mirrored file by hand while the vessel stands and no watcher runs. Nothing in the wiki
 * changed, so no reconcile marked the carrier. The list op looks first: it reads the tree afresh, finds each
 * carrier whose base stands at a mirror path that holds no file, and hands those to the gate. The carrier
 * pends by the time the list answers, and `restore` then answers it.
 *
 * Controls: an untouched carrier never pends; a base at a holding path outside the mirror, whose file left,
 * pends nothing (that file stays its person's and no mirror weighs it).
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { syncedTreeKey } from "../src/synced-tree.js";
import { answerShore } from "../src/shore-verb.js";

type Listed = { ok: boolean; pending: Array<{ uri: string }>; pendingCount: number; standoffs: unknown[] };

describe.skipIf(coreBlobSkip)("the shore list looks at the disk first", () => {
  let rig: ShoreRig;
  beforeAll(async () => {
    rig = await ShoreRig.stand(3);
    await rig.ingest();
    await rig.boot();
  }, 300_000);
  afterAll(async () => { await rig?.close(); });

  test("CONTROL: with every file standing the list names nothing", async () => {
    const listed = await answerShore(rig.projector, { op: "list" }) as unknown as Listed;
    expect([listed.ok, listed.pending, listed.standoffs]).toEqual([true, [], []]);
  });

  test("a file removed by hand with no watcher pends at the next list, and restore answers it", async () => {
    const [uri, untouched] = rig.uris;
    // A base at a holding path whose file never stood: outside the mirror, so no look weighs it.
    rig.tree.set(syncedTreeKey(RIG_BAG, untouched!), path.join(rig.scratch, "wikis", "inbox", "gone.mem"), "sha256:00", "sha256:00");
    rig.remove(uri!);
    expect(rig.stands(uri!)).toBe(false);
    expect(rig.projector.pendingRemovals()).toEqual([]);          // nothing marked the carrier

    const listed = await answerShore(rig.projector, { op: "list" }) as unknown as Listed;
    expect(listed.pending.map((p) => p.uri)).toEqual([uri]);
    expect(listed.pendingCount).toBe(1);
    expect(rig.stands(uri!)).toBe(false);                         // the look writes nothing back

    const restored = await answerShore(rig.projector, { op: "restore", uris: [uri] }) as { ok: boolean; done?: string[] };
    expect([restored.ok, restored.done]).toEqual([true, [uri]]);
    expect(rig.stands(uri!)).toBe(true);
    const after = await answerShore(rig.projector, { op: "list" }) as unknown as Listed;
    expect(after.pending).toEqual([]);
  });
});
