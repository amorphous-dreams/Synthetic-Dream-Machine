/**
 * nexus-client-dial.test — B1: the PRODUCTION client dial-out leg, headless, in ONE process.
 *
 * live-wire-node-crossing.test (S1) proved a node dialing another via an INLINE `new LarWSClientAdapter`
 * passed at Repo construction. THIS proves the PRODUCTION helper `startNexusClientDial` — the one the live
 * vessel mounts onto its ALREADY-RUNNING Repo — carries the same crossing: a full node stands its server +
 * gate, THEN mounts the dial onto its live repo (exactly the vessel flow), and syncs a peer's doc both ways.
 *
 * It proves:
 *   (1) the dial mounts onto a live Repo → a doc authored on peer B reaches the DIALING node A (B → A);
 *   (2) a change authored on A flows back to B (A → B) — the breath both ways over ONE crossed socket;
 *   (3) INERT: `maybeStartNexusClientDial` with no sync URL (or a sync URL but no gate key) returns null and
 *       adds NO adapter to the repo — the unconfigured boot opens zero client socket, zero behaviour change;
 *   (4) `stop()` disconnects the mounted adapter cleanly (no leaked socket).
 *
 * Every crypto piece stays REAL: a real sovereign gate (`faceGateServer` over a sealed session table), the Noise IK
 * flight and presented admit bound to the DIALED gate's pin, real Automerge CRDT sync. Two sockets stay two — this
 * rides the Automerge `/ws` (Socket A).
 *
 * Gate: lar:///ha.ka.ba/lararium/node/nexus-client-dial
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { hearthPinIndex } from "../../lararium-mesh/src/admit-gate-pin.js";
import { presenter, AUDIENCE } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { restEvery } from "./resting-repo.js";
import { realDeadlines } from "./oracle-floor-rig.js";
import { standGatedNode, type GatedNode } from "./gated-node-rig.js";
import { startNexusClientDial, maybeStartNexusClientDial } from "../src/nexus-client-dial.js";

const GREETING_KEY = "lar:///ha.ka.ba/bags/crossroads/greeting";
const REPLY_KEY    = "lar:///ha.ka.ba/bags/personal/reply";
type GreetDoc = { tiddlers: Record<string, { text: string }> };

/** What a production dial is handed to reach `far`: the pair index holding its sovereign pin, and a presenter its gate sorts. */
async function dialInputs(far: GatedNode, label: string) {
  const pins = hearthPinIndex();
  pins.put("hearth-far", far.world.pin);
  const p = await presenter(far.world, label);
  return {
    pins, hearth: "hearth-far", nexus: far.world.pin.nexus, aud: AUDIENCE, deadlines: realDeadlines(),
    presentation: { certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history },
  };
}

/** Resolve once the gate seats a crossed peer (the dial's socket is up), or reject after `ms`. Mounting
 *  the dial post-construction means the repo's `whenReady()` has already resolved on the server adapter, so
 *  a `find()` fired before the crossing completes races to "unavailable"; the operator's pull rides AFTER the
 *  socket is up — this waits for that, the faithful order. */
function awaitPeer(node: GatedNode, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const tick = (): void => {
      if (node.seated() >= 1) { resolve(); return; }
      if (Date.now() - started > ms) { reject(new Error("timeout: dial never crossed the gate")); return; }
      setTimeout(tick, 25);
    };
    tick();
  });
}

/** Resolve `url`'s handle once its query reaches `ready`, tolerating a TRANSIENT `unavailable`; reject on
 *  `ms` timeout. This is the OBSERVATION POINT: `repo.find()` rejects the instant every source settles
 *  `unavailable` (Repo.find → DocumentQuery.whenReady raises `Document … is unavailable`, DocumentQuery.ts:199),
 *  and on a just-mounted dial that condition is a LIE — storage has the doc on no disk and the automerge-sync
 *  source sees zero peers in the window before the crossed peer ANNOUNCES it (DocSynchronizer#updateAvailability,
 *  `peers.size === 0` → sourceUnavailable), so the query blinks `unavailable` and `find` reports the doc GONE
 *  while it is still arriving. The reactive `findWithProgress` subscription rides the SAME query as the peer's
 *  announce re-enters it into `loading` → `ready` (DocSynchronizer calls sourcePending on peer/announce), so it
 *  resolves on the true `ready` and never on the transient blink — the shape automerge-repo v2.6 itself points
 *  to (`RepoFindOptions.allowableStates` is deprecated and IGNORED in this alpha, Repo.ts:923-928, which is why
 *  passing it to `find` changed nothing). */
function findWhenReady<T>(repo: Repo, url: AutomergeUrl, ms: number, said: () => string = () => ""): Promise<DocHandle<T>> {
  return new Promise<DocHandle<T>>((resolve, reject) => {
    const progress = repo.findWithProgress<T>(url);
    const states: string[] = [];
    let unsub: () => void = () => { /* set below */ };
    // A RED HERE NAMES WHAT STOOD, never only that time ran out: every state the query passed through, and what
    // the caller reads of the crossing at that moment. A bare timeout taught nothing the one time it fired.
    const timer = setTimeout(() => { unsub(); reject(new Error(`timeout: ${url} never became ready (states ${states.join(" → ")}; ${said()})`)); }, ms);
    const settle = (state: ReturnType<typeof progress.peek>): void => {
      if (states[states.length - 1] !== state.state) states.push(state.state);
      if (state.state === "ready") { clearTimeout(timer); unsub(); resolve(state.handle); }
    };
    unsub = progress.subscribe(settle);
    settle(progress.peek());
  });
}

/**
 * Resolve once `repo` holds `peerId` as a connected peer: the DIAL'S OWN event (the network subsystem's `peer`,
 * which the client adapter raises after the gate's verdict and the sync join), never a poll of the far gate.
 * A gate that admitted a socket proves the far side; this proves the near side's synchronizer gained the peer.
 */
function awaitRepoPeer(repo: Repo, peerId: string, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const holds = (): boolean => repo.peers.includes(peerId as (typeof repo.peers)[number]);
    const onPeer = (): void => { if (holds()) { clearTimeout(timer); repo.networkSubsystem.off("peer", onPeer); resolve(); } };
    const timer = setTimeout(() => { repo.networkSubsystem.off("peer", onPeer); reject(new Error(`timeout: the dialing repo never gained peer ${peerId}`)); }, ms);
    repo.networkSubsystem.on("peer", onPeer);   // the Repo's own listener, registered at its construction, adds the peer first
    onPeer();
  });
}

/** Resolve once `handle`'s doc carries `key`, or reject after `ms`. */
function awaitKey(handle: { doc: () => GreetDoc | undefined; on: (e: "change", cb: () => void) => void }, key: string, ms: number, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
    const check = (): void => { if (handle.doc()?.tiddlers?.[key]) { clearTimeout(timer); resolve(); } };
    handle.on("change", check);
    check();
  });
}

describe("B1 — the production client dial-out mounts onto a live Repo and crosses the gate", () => {
  const dirs: string[] = [];
  let nodes: GatedNode[] = [];
  const dials: Array<{ stop: () => void }> = [];

  function mkStorageDir(): string { const d = mkdtempSync(join(tmpdir(), "lar-nexusdial-")); dirs.push(d); return d; }

  afterEach(async () => {
    for (const d of dials.splice(0)) { try { d.stop(); } catch { /* already down */ } }
    for (const n of nodes) { try { await n.close(); } catch { /* already down */ } }
    nodes = [];
    // Every vessel's Repo rests (its adapter closed) before its directory leaves: no save of its can land after.
    await restEvery();
    for (const d of dirs.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* gone */ } }
  });

  test("node A mounts the dial onto its LIVE repo, syncs B's doc, and a change flows back (both ways)", async () => {
    // Vessel B — the DIALED node; its gate sorts the face A presents.
    const nodeB = await standGatedNode({ storageDir: mkStorageDir() });
    nodes.push(nodeB);
    // Vessel A — a full server vessel, THEN the production dial mounts onto its already-running repo.
    const nodeA = await standGatedNode({ storageDir: mkStorageDir(), nexus: "nexus-a.synthetic" });
    nodes.push(nodeA);

    const adaptersBefore = nodeA.repo.networkSubsystem.adapters.length;
    const dial = startNexusClientDial({ repo: nodeA.repo, syncUrl: nodeB.url, ...(await dialInputs(nodeB, "node a")) });
    dials.push(dial);
    // The mount added exactly one adapter (Socket A) to the live repo.
    expect(nodeA.repo.networkSubsystem.adapters.length).toBe(adaptersBefore + 1);

    // B authors a doc — its AutomergeUrl is the capability token A resolves across the crossed socket.
    const docB = nodeB.repo.create<GreetDoc>({ tiddlers: {} });
    docB.change((d) => { d.tiddlers[GREETING_KEY] = { text: "the DreamNet breathes" }; });

    // Wait for the dial to CROSS the gate before pulling — the operator's find rides an up socket.
    await awaitPeer(nodeB, 6_000);
    // ...and the DIALING repo holds B as a peer, by the dial's own event: the near half of the same crossing.
    await awaitRepoPeer(nodeA.repo, nodeB.repo.peerId, 6_000);

    // B → A: the dialing node finds + syncs B's doc.
    //
    // A CROSSED SOCKET IS NOT AN ANNOUNCED DOC. `awaitPeer` proves the dial reached B's gate (the SERVER
    // side); the sync protocol still has to tell A that B holds this document, and A's own client-side
    // DocSynchronizer for it has to gain the peer. In the window between the two, a `repo.find()` here
    // settles to `unavailable` and REJECTS — the instrument-lie the operator named: the doc reads GONE
    // while it is still arriving. `findWhenReady` observes that transient blink and waits out the true
    // `ready` instead (see its doc-comment for the mechanism + the two refuted cures it supersedes).
    const foundOnA = await findWhenReady<GreetDoc>(nodeA.repo, docB.url as AutomergeUrl, 8_000,
      () => `A's peers ${JSON.stringify(nodeA.repo.peers)}, B's seated sessions ${nodeB.seated()}, dial anergized ${String(dial.adapter.anergized)}`);
    await awaitKey(foundOnA, GREETING_KEY, 5_000, "node A never synced node B's doc");
    expect(foundOnA.doc()?.tiddlers?.[GREETING_KEY]?.text).toBe("the DreamNet breathes");

    // A → B: A writes; B observes over the same crossed socket (the breath both ways).
    foundOnA.change((d) => { d.tiddlers[REPLY_KEY] = { text: "node A answers" }; });
    await awaitKey(docB, REPLY_KEY, 5_000, "node B never saw node A's change");
    expect(docB.doc()?.tiddlers?.[REPLY_KEY]?.text).toBe("node A answers");

    expect(nodeB.seated()).toBe(1);                // the dialing node crossed the gate as a real peer
    expect(dial.adapter.anergized).toBeNull();     // admitted → never anergized

    // stop() disconnects cleanly — no leaked socket past teardown.
    dial.stop();
  }, 12_000);

  test("INERT: no sync URL → maybeStart returns null and adds NO adapter (the unconfigured boot is untouched)", async () => {
    const nodeB = await standGatedNode({ storageDir: mkStorageDir() });
    nodes.push(nodeB);
    const node = await standGatedNode({ storageDir: mkStorageDir(), nexus: "nexus-a.synthetic" });
    nodes.push(node);
    const inputs = await dialInputs(nodeB, "node a");

    const before = node.repo.networkSubsystem.adapters.length;
    // The default path: no join config rides the boot.
    const dial = maybeStartNexusClientDial({ repo: node.repo, ...inputs, syncUrl: null });
    expect(dial).toBeNull();
    expect(node.repo.networkSubsystem.adapters.length).toBe(before);   // zero socket, zero change

    // Fail-closed: a sync URL with NO pin held for the hearth and Nexus cannot reach any gate → still inert.
    const said: string[] = [];
    const dialNoPin = maybeStartNexusClientDial({ repo: node.repo, ...inputs, pins: hearthPinIndex(), syncUrl: nodeB.url, onLog: (l) => said.push(l) });
    expect(dialNoPin).toBeNull();
    expect(said.some((l) => l.includes("pin-absent"))).toBe(true);
    // ...and a sync URL with nothing to present is inert too, and says so by name.
    const dialNoFace = maybeStartNexusClientDial({ repo: node.repo, ...inputs, presentation: null, syncUrl: nodeB.url, onLog: (l) => said.push(l) });
    expect(dialNoFace).toBeNull();
    expect(said.some((l) => l.includes("presentation-absent"))).toBe(true);
    expect(node.repo.networkSubsystem.adapters.length).toBe(before);   // still no adapter mounted
  });

  test("CONFIGURED: a sync URL + a held pin + a presentation → maybeStart mounts exactly one adapter (the bite of the inert gate)", async () => {
    // The matched positive control: flip the inputs the INERT test withholds, the outcome flips — proving the
    // null return hangs on the missing config, not on incidental failure. (Points at B's port; stop() before sync.)
    const nodeB = await standGatedNode({ storageDir: mkStorageDir() });
    nodes.push(nodeB);
    const node = await standGatedNode({ storageDir: mkStorageDir(), nexus: "nexus-a.synthetic" });
    nodes.push(node);

    const before = node.repo.networkSubsystem.adapters.length;
    const dial = maybeStartNexusClientDial({ repo: node.repo, ...(await dialInputs(nodeB, "node a")), syncUrl: nodeB.url });
    expect(dial).not.toBeNull();
    expect(node.repo.networkSubsystem.adapters.length).toBe(before + 1);
    dial!.stop();
  });
});
