/**
 * live-wire-node-crossing.test.ts — LIVE-WIRE S1: two NODE vessels replicate a doc over a real sealed gate, one
 * dialing the other, headless, in ONE process.
 *
 * A full node vessel — its OWN sovereign gate on its OWN port (`faceGateServer`, its sessions read by a
 * `gateSyncServer` the Repo's adapter serves), NodeFS storage on its OWN dir — mounts a `LarWSClientAdapter`
 * carrying a face the other node's gate sorts and dials ANOTHER node's sync route. Every crypto piece stays REAL:
 * the Noise IK flight, the presented admit, the signed verdict, real Automerge CRDT sync over the sealed channel.
 *
 * It proves:
 *   (1) a doc authored on vessel B reaches the DIALING node A (B → A);
 *   (2) a change authored on A flows back to B (A → B) — the breath both ways over ONE crossed socket;
 *   (3) a node presenting NO admit under a PRIVATE gate meets silence and never becomes a peer, while the SAME
 *       node presenting its admit DOES sync — so the sort bites by construction (the deny is load-bearing, not an
 *       incidental transport failure).
 *
 * Gate: lar:///ha.ka.ba/lararium/node/live-wire-node-crossing
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { restEvery } from "./resting-repo.js";
import { standGatedNode, type GatedNode } from "./gated-node-rig.js";

const GREETING_KEY = "lar:///ha.ka.ba/bags/crossroads/greeting";
const REPLY_KEY    = "lar:///ha.ka.ba/bags/personal/reply";
type GreetDoc = { tiddlers: Record<string, { text: string }> };

/** Resolve once `handle`'s doc carries `key`, or reject after `ms` (a denial reads as "never synced"). */
function awaitKey(handle: { doc: () => GreetDoc | undefined; on: (e: "change", cb: () => void) => void }, key: string, ms: number, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
    const check = (): void => { if (handle.doc()?.tiddlers?.[key]) { clearTimeout(timer); resolve(); } };
    handle.on("change", check);
    check();
  });
}

describe("LIVE-WIRE S1 — two NODE vessels, one dialing the other over a real sealed gate", () => {
  const dirs: string[] = [];
  let nodes: GatedNode[] = [];

  function mkStorageDir(): string { const d = mkdtempSync(join(tmpdir(), "lar-livewire-")); dirs.push(d); return d; }

  afterEach(async () => {
    for (const n of nodes) { try { await n.close(); } catch { /* already down */ } }
    nodes = [];
    // Every vessel's Repo rests (its adapter closed) before its directory leaves: no save of its can land after.
    await restEvery();
    for (const d of dirs.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* gone */ } }
  });

  test("node A dials node B; a doc authored on B replicates to A, AND a change on A flows back to B (both ways)", async () => {
    // Vessel B — the DIALED node. Its gate admits the face A presents.
    const nodeB = await standGatedNode({ storageDir: mkStorageDir() });
    nodes.push(nodeB);
    // Vessel A — a FULL node (its own gate on its own port + storage) that ALSO dials B carrying an admit.
    const nodeA = await standGatedNode({ storageDir: mkStorageDir(), nexus: "nexus-a.synthetic", dialOut: { node: nodeB, label: "node a" } });
    nodes.push(nodeA);

    // B authors a doc — its AutomergeUrl is the capability token A resolves across the crossed socket.
    const docB = nodeB.repo.create<GreetDoc>({ tiddlers: {} });
    docB.change((d) => { d.tiddlers[GREETING_KEY] = { text: "the DreamNet breathes" }; });

    // B → A: the dialing node finds + syncs B's doc.
    const foundOnA = await nodeA.repo.find<GreetDoc>(docB.url);
    await awaitKey(foundOnA, GREETING_KEY, 5_000, "node A never synced node B's doc");
    expect(foundOnA.doc()?.tiddlers?.[GREETING_KEY]?.text).toBe("the DreamNet breathes");

    // A → B: A writes to the same handle; B observes it over the same crossed socket (the breath both ways).
    foundOnA.change((d) => { d.tiddlers[REPLY_KEY] = { text: "node A answers" }; });
    await awaitKey(docB, REPLY_KEY, 5_000, "node B never saw node A's change");
    expect(docB.doc()?.tiddlers?.[REPLY_KEY]?.text).toBe("node A answers");

    // The dialing node crossed the gate as a real peer.
    expect(nodeB.seated()).toBe(1);
  }, 12_000);

  // The deny and its positive control run as a MATCHED PAIR — identical wiring, the presented admit the only
  // difference. Together they prove the deny hangs on the sort (the bite), not on incidental transport failure:
  // flip the one input, the outcome flips.

  test("a node presenting NO admit is silence under PRIVATE — it never becomes a peer and never syncs (the barrier holds)", async () => {
    const nodeB = await standGatedNode({ storageDir: mkStorageDir() });             // PRIVATE: the world's default posture
    nodes.push(nodeB);

    const docB = nodeB.repo.create<GreetDoc>({ tiddlers: {} });
    docB.change((d) => { d.tiddlers[GREETING_KEY] = { text: "the DreamNet breathes" }; });

    const nodeC = await standGatedNode({ storageDir: mkStorageDir(), nexus: "nexus-a.synthetic", dialOut: { node: nodeB, arm: null, label: "node c" } });
    nodes.push(nodeC);

    // A denied node holds no peer and no local copy, so find() never resolves the doc — bound it in a race
    // and assert the doc never crossed.
    const findOutcome = await Promise.race([
      nodeC.repo.find<GreetDoc>(docB.url).then(() => "found" as const, () => "unavailable" as const),
      new Promise<"pending">((r) => setTimeout(() => r("pending"), 1_500)),
    ]);
    expect(findOutcome).not.toBe("found");         // the denied node never synced B's doc
    expect(nodeB.seated()).toBe(0);                // never a peer — the real barrier held
    expect(nodeC.client?.anergized).toBeNull();    // silence is a transport fault, never a named anergy
  }, 12_000);

  test("the positive control (the bite): the SAME setup presenting its admit DOES sync", async () => {
    const nodeB = await standGatedNode({ storageDir: mkStorageDir() });
    nodes.push(nodeB);

    const docB = nodeB.repo.create<GreetDoc>({ tiddlers: {} });
    docB.change((d) => { d.tiddlers[GREETING_KEY] = { text: "the DreamNet breathes" }; });

    // The ONLY change from the deny test: C presents its admit → the crossing must now breathe.
    const nodeC = await standGatedNode({ storageDir: mkStorageDir(), nexus: "nexus-a.synthetic", dialOut: { node: nodeB, label: "node c" } });
    nodes.push(nodeC);

    const foundOnC = await nodeC.repo.find<GreetDoc>(docB.url);
    await awaitKey(foundOnC, GREETING_KEY, 5_000, "admitted node C never synced (positive control failed)");
    expect(foundOnC.doc()?.tiddlers?.[GREETING_KEY]?.text).toBe("the DreamNet breathes");
    expect(nodeC.client?.anergized).toBeNull();    // admitted → never anergized
  }, 12_000);
});
