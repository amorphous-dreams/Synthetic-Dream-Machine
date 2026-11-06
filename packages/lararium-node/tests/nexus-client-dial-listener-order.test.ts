/**
 * nexus-client-dial-listener-order.test — G56: the dialed node's gate opens a session socket; the server adapter's
 * `connection` listener (installed by `connect()`, which the Repo calls only AFTER its storage id resolves) must
 * already stand, or the dialer's join lands on a socket nothing listens to and the dialing Repo never gains the peer.
 *
 * The witness HOLDS the order with the product's own events, never a sleep: the dialed Repo's storage-id load waits on
 * a barrier; the barrier opens after the gate opens the session, before the adapter connects. The gate holds the channel until
 * the adapter installs its listener, so queued frames reach the socket only after handoff. Control: the barrier starts open.
 *
 * Gate: lar:///ha.ka.ba/lararium/node/nexus-client-dial/listener.order.holds
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type StorageKey } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { hearthPinIndex } from "../../lararium-mesh/src/admit-gate-pin.js";
import { world, presenter, AUDIENCE } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { faceGateServer, gateSessionRegistry } from "../src/face-gate-server.js";
import { gateSyncServer } from "../src/gate-sync-server.js";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { startNexusClientDial } from "../src/nexus-client-dial.js";
import { restEvery } from "./resting-repo.js";
import { realDeadlines } from "./flow-floor-rig.js";
import { standGatedNode, type GatedNode } from "./gated-node-rig.js";

const deferred = (): { promise: Promise<void>; open: () => void } => {
  let open: () => void = () => { /* set below */ };
  const promise = new Promise<void>((resolve) => { open = resolve; });
  return { promise, open };
};

/** The storage-id load waits on `barrier`: the Repo's `connect()` (its metadata promise) rides it. */
class HeldIdStorage extends DurableNodeFSStorageAdapter {
  constructor(dir: string, private readonly barrier: Promise<void>) { super(dir); }
  override async load(key: StorageKey): Promise<Uint8Array | undefined> {
    if (key.length === 1 && key[0] === "storage-adapter-id") await this.barrier;
    return super.load(key);
  }
}

class ProbedServerAdapter extends NodeWSServerAdapter {
  readonly connected = deferred();
  didConnect = false;
  override isReady(): boolean { return true; }
  override whenReady(): Promise<void> { return Promise.resolve(); }
  override connect(...a: Parameters<NodeWSServerAdapter["connect"]>): void { super.connect(...a); this.didConnect = true; this.connected.open(); }
}

describe("G56 — the dialed server adapter's listener stands before the dialer's frames reach the gate socket", () => {
  const dirs: string[] = [];
  const nodes: GatedNode[] = [];
  const closers: Array<() => void> = [];
  afterEach(async () => {
    for (const c of closers.splice(0)) { try { c(); } catch { /* down */ } }
    for (const n of nodes.splice(0)) { try { await n.close(); } catch { /* down */ } }
    await restEvery();
    for (const d of dirs.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* gone */ } }
  });
  const mk = (): string => { const d = mkdtempSync(join(tmpdir(), "lar-g56-")); dirs.push(d); return d; };

  /** Stand dialed node B by hand (the rig's shape) with its storage-id behind `barrier`; return the instruments. */
  async function standB(barrier: Promise<void>, onSessionOpen: () => void) {
    const ready = deferred();
    const gateSync = gateSyncServer({ adapterConnected: ready.promise });
    let connectedAtOpen = false;
    const registry = gateSessionRegistry((channel, session) => { connectedAtOpen = serverNetwork.didConnect; gateSync.onOpen(channel, session); onSessionOpen(); });
    const w = await world({ sessions: registry.table });
    const server = faceGateServer();
    server.stand({ gate: w.gate, pin: w.pin });
    const http = createServer();
    http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", () => resolve()));
    const port = (http.address() as { port: number }).port;

    const lost: string[] = [];          // frames the gate socket emitted while no `message` listener stood
    const gateOpened = deferred();
    gateSync.wss.on("connection", (socket) => {
      gateOpened.open();
      const emit = socket.emit.bind(socket) as (ev: string, ...a: unknown[]) => boolean;
      (socket as { emit: unknown }).emit = (ev: string, ...a: unknown[]): boolean => {
        if (ev === "message") { if (socket.listenerCount("message") === 0) lost.push("message"); }
        return emit(ev, ...a);
      };
    });
    const serverNetwork = new ProbedServerAdapter(gateSync.wss as never);
    void serverNetwork.connected.promise.then(ready.open);
    const repo = new Repo({ network: [serverNetwork], storage: new HeldIdStorage(mk(), barrier) });
    const close = async (): Promise<void> => {
      barrier.then(() => undefined);
      try { await repo.shutdown(); } catch { /* down */ }
      server.close(); registry.close(); gateSync.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    };
    return { w, repo, url: `ws://127.0.0.1:${port}/ws`, lost, gateOpened, serverNetwork, connectedAtOpen: () => connectedAtOpen, close };
  }

  async function cross(hold: boolean): Promise<{ lost: string[]; gained: Promise<void> }> {
    const gate = deferred();
    const barrier = hold ? gate.promise : Promise.resolve();
    const b = await standB(barrier, () => gate.open());      // session open releases storage, after the gate has accepted the channel
    closers.push(() => { gate.open(); void b.close(); });
    const a = await standGatedNode({ storageDir: mk(), nexus: "nexus-a.synthetic" });
    nodes.push(a);
    const pins = hearthPinIndex();
    pins.put("hearth-far", b.w.pin);
    const p = await presenter(b.w, "node a");
    const dial = startNexusClientDial({
      repo: a.repo, syncUrl: b.url, pins, hearth: "hearth-far", nexus: b.w.pin.nexus, aud: AUDIENCE, deadlines: realDeadlines(),
      presentation: { certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history },
    });
    closers.push(() => dial.stop());
    await b.gateOpened.promise;                  // the gate seated the dialer
    await b.serverNetwork.connected.promise;     // the server adapter's listener has stood
    if (hold) expect(b.connectedAtOpen()).toBe(false);
    const gained = new Promise<void>((resolve) => {
      const holds = (): boolean => b.repo.peers.includes(a.repo.peerId as (typeof b.repo.peers)[number]);
      const on = (): void => { if (holds()) { b.repo.networkSubsystem.off("peer", on); resolve(); } };
      b.repo.networkSubsystem.on("peer", on); on();
    });
    return { lost: b.lost, gained };
  }

  test("held storage: the gate opens before the listener stands → no frame lost and the Repo gains the dialer", async () => {
    const { lost, gained } = await cross(true);
    expect(lost).toEqual([]);
    await gained;
  }, 12_000);

  test("CONTROL (normal order): the listener stands before the gate opens → no frame lost and the dialed Repo gains the dialer", async () => {
    const { lost, gained } = await cross(false);
    expect(lost).toEqual([]);
    await gained;
  }, 12_000);
});
