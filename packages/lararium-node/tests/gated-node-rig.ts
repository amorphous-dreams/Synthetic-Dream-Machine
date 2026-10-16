/**
 * gated-node-rig — a node vessel's sync route, stood the way a boot stands it, for suites that cross a live gate.
 *
 * A node STANDS a sovereign gate (`faceGateServer` over a world's gate, its sessions handed to a
 * `gateSyncServer` the Repo's `NodeWSServerAdapter` reads) and may DIAL another node's gate (a `LarWSClientAdapter`
 * carrying a presenter the dialed gate sorts). A suite names no frame of any handshake: it holds a node, a verdict
 * and a doc.
 *
 * Test support. No source file imports it.
 */
import { createServer, type Server } from "node:http";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { LarWSClientAdapter, type FederationPosture, type LarWSClientOptions } from "@lararium/mesh";
import { hearthPinIndex } from "../../lararium-mesh/src/admit-gate-pin.js";
import { world, presenter, AUDIENCE, type World, type Presenter } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { faceGateServer, gateSessionRegistry } from "../src/face-gate-server.js";
import { gateSyncServer } from "../src/gate-sync-server.js";
import { restingRepo, type RestingRepo } from "./resting-repo.js";
import { dialer, realDeadlines } from "./oracle-floor-rig.js";

/** Node-side readiness override (as `open-node-vessel` stands it): ready from listen, never from a first client. */
class ReadyWSServerAdapter extends NodeWSServerAdapter {
  override isReady(): boolean { return true; }
  override whenReady(): Promise<void> { return Promise.resolve(); }
}

export interface GatedNode {
  readonly repo:   RestingRepo;
  readonly port:   number;
  /** The world this node's gate stands in: its pin, its posture, its held admits. */
  readonly world:  World;
  /** The sync URL a dialer reaches this node at (the gate's route; the knock rides the upgrade). */
  readonly url:    string;
  /** How many sessions the gate has opened and the server still holds. */
  seated(): number;
  /** The dial-out adapter, when this node dials another. */
  readonly client: LarWSClientAdapter | null;
  /** The dial-out leaf's own word that it anergized (`onAnergy`); never resolves on a node that dials nobody. */
  readonly anergy: Promise<string>;
  close(): Promise<void>;
}

export interface DialOut {
  readonly node:      GatedNode;
  /** Present the face's admit (default), or nothing. */
  readonly arm?:      "admit" | null;
  readonly label?:    string;
  readonly presenter?: Presenter;
  /** The pin the dial holds for the far gate, where a suite pins another gate's key instead of the far node's own. */
  readonly pin?:      World["pin"];
}

/** Stand a node: an http server, its sovereign gate over `world`, the Repo reading the gate's sessions, and optionally a dial-out. */
export async function standGatedNode(opts: { storageDir: string; nexus?: string; posture?: FederationPosture; dialOut?: DialOut }): Promise<GatedNode> {
  const gateSync = gateSyncServer();
  const registry = gateSessionRegistry((channel, session) => gateSync.onOpen(channel, session));
  const w = await world({ ...(opts.nexus ? { nexus: opts.nexus } : {}), ...(opts.posture ? { posture: opts.posture } : {}), sessions: registry.table });
  const server = faceGateServer();
  server.stand({ gate: w.gate, pin: w.pin });
  const http: Server = createServer();
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", () => resolve()));
  const port = (http.address() as { port: number }).port;

  const serverNetwork = new ReadyWSServerAdapter(gateSync.wss as never);
  let client: LarWSClientAdapter | null = null;
  let onAnergy: (reason: string) => void = () => { /* a node that dials nobody */ };
  const anergy = new Promise<string>((resolve) => { onAnergy = resolve; });
  const network: Array<ReadyWSServerAdapter | LarWSClientAdapter> = [serverNetwork];
  if (opts.dialOut) {
    const far = opts.dialOut.node;
    const p = opts.dialOut.presenter ?? await presenter(far.world, opts.dialOut.label ?? "dialing node");
    const pins = hearthPinIndex();
    pins.put("hearth-far", opts.dialOut.pin ?? far.world.pin);
    const options: LarWSClientOptions = {
      url: far.url, pins, hearth: "hearth-far", nexus: (opts.dialOut.pin ?? far.world.pin).nexus, audience: AUDIENCE, deadlines: realDeadlines(),
      presentation: { certificate: p.certificate, signer: p.signer, arm: opts.dialOut.arm === null ? null : p.arm, history: p.history },
      dialSocket: () => dialer(far.url), retryInterval: 100, onAnergy: (reason) => onAnergy(reason),
    };
    client = new LarWSClientAdapter(options);
    network.push(client);
  }
  const repo = restingRepo(opts.storageDir, {
    network,
    // A peer on THIS node's own gate shares once the gate seated it (a socket exists only after a verdict); a peer
    // reached over the OUTBOUND leg is not on the server's sockets and is shared with freely: a node serves gated, dials open.
    sharePolicy: async (peerId) => {
      const socket = (serverNetwork.sockets as Record<string, unknown> | undefined)?.[peerId];
      return socket ? gateSync.sessionOf(socket as never) !== null : true;
    },
  });
  return {
    repo, port, world: w, url: `ws://127.0.0.1:${port}/ws`, client, anergy,
    seated: () => gateSync.wss.clients.size,
    close: async () => {
      try { client?.disconnect(); } catch { /* never connected */ }
      await repo.rest();
      server.close(); registry.close(); gateSync.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
