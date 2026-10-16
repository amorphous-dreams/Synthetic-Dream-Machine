/**
 * crossing-roles — the two halves of the containerized crossing over the SEALED GATE, each a function a probe calls and a
 * node test runs in-process.
 *
 * The NODE half (`standCrossingDaemon`) stands a sovereign gate (`faceGateServer` over a gate whose sessions a
 * `gateSyncServer` reads), an Automerge Repo that shares only through a seated gate session, and a seeded doc. The
 * CLIENT half (`crossRole`) wears a face and dials it with a `LarWSClientAdapter`; its verdict says whether the gate did
 * the right thing for its role:
 *
 *   admitted    a face the Nexus admitted CROSSES, reads the seeded doc and writes back.
 *   anon        a gate that admits NOBODY turns that same face away; the denied leaf then founds its OWN island.
 *   impostor    a presentation whose certificate and admit are the admitted face's, signed by ANOTHER face's session
 *               signer, is refused: possession proves who, never a claim.
 *   wrong-bind  a presentation bound to an audience the gate did not arm is refused.
 *
 * A denial reads as silence: the gate answers nothing, the dial anergizes, and the doc never arrives. The world both halves
 * stand in derives from one label (`synthetic-gate-world`), so the two containers share only a volume: the gate's pin, the
 * doc's URL and the port ride `crossing.json`.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/browser-crossing
 */
import { createServer, type Server } from "node:http";
import { Repo, type AutomergeUrl, type DocHandle } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { LarWSClientAdapter, hearthPinIndex, type FederationPosture } from "@lararium/mesh";
import { CROSSING_AUDIENCE, crossingFace, forgedFace, standCrossingGate, type CrossingFace } from "./crossing-synthetic-world.js";
import type { GateBundlePin } from "@lararium/mesh";
import { faceGateServer, gateSessionRegistry } from "../src/face-gate-server.js";
import { gateSyncServer } from "../src/gate-sync-server.js";

export const CROSSING_NEXUS = "crossing.nexus.synthetic";
export const WRONG_AUDIENCE = "lar:///ha.ka.ba/bags/personal";
export const GREETING_KEY = "lar:///ha.ka.ba/bags/crossroads/greeting";
export const REPLY_KEY = "lar:///ha.ka.ba/bags/personal/reply";
export type CrossRole = "admitted" | "anon" | "impostor" | "wrong-bind";
export type GreetDoc = { tiddlers: Record<string, { text: string }> };

/** Node-side readiness override (as `open-node-vessel` stands it): ready from listen, never from a first client. */
class ReadyWSServerAdapter extends NodeWSServerAdapter {
  override isReady(): boolean { return true; }
  override whenReady(): Promise<void> { return Promise.resolve(); }
}

/** The coordinates the daemon publishes to the client: plain strings, so they ride a JSON file on the shared volume. */
export interface CrossingCoordinates { readonly pin: GateBundlePin; readonly docUrl: string; readonly port: number }

export interface CrossingDaemon {
  readonly coordinates: CrossingCoordinates;
  /** Resolves once a peer's write-back has landed in the seeded doc. */
  readonly sawReply: Promise<void>;
  /** Peers the gate has seated on its sync server. */
  seated(): number;
  close(): Promise<void>;
}

/** Stand the node half. `admit: "none"` holds no Nexus root, so the gate turns every face away. */
export async function standCrossingDaemon(opts: {
  port: number; host?: string; greet: string; admit: "from-file" | "none"; posture?: FederationPosture; log?: (line: string) => void;
}): Promise<CrossingDaemon> {
  const log = opts.log ?? (() => { /* quiet */ });
  const gateSync = gateSyncServer();
  const registry = gateSessionRegistry((channel, session) => gateSync.onOpen(channel, session));
  const stood = await standCrossingGate({
    nexus: CROSSING_NEXUS, sessions: registry.table, admitting: opts.admit !== "none", ...(opts.posture ? { posture: opts.posture } : {}),
  });
  const server = faceGateServer();
  server.stand({ gate: stood.gate, pin: stood.pin });
  const http: Server = createServer();
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });

  const network = new ReadyWSServerAdapter(gateSync.wss as never);
  const repo = new Repo({
    network: [network],
    // A peer shares only once the gate seated it: a socket exists on the adapter only after a verdict.
    sharePolicy: async (peerId) => {
      const socket = (network.sockets as Record<string, unknown> | undefined)?.[peerId];
      return socket ? gateSync.sessionOf(socket as never) !== null : false;
    },
  });
  const doc = repo.create<GreetDoc>({ tiddlers: {} });
  doc.change((d) => { d.tiddlers[GREETING_KEY] = { text: opts.greet }; });
  let saw: () => void = () => { /* set below */ };
  const sawReply = new Promise<void>((resolve) => { saw = resolve; });
  doc.on("change", () => {
    if (doc.doc()?.tiddlers?.[REPLY_KEY]) { log("[crossing-daemon] ✓ observed the leaf's write-back — the breath runs both ways"); saw(); }
  });

  await new Promise<void>((resolve, reject) => { http.once("error", reject); http.listen(opts.port, opts.host ?? "0.0.0.0", () => resolve()); });
  const port = (http.address() as { port: number }).port;
  log(`[crossing-daemon] admit policy=${opts.admit} → gate ${opts.admit === "none" ? "admits nobody" : "admits the crossing face"}`);
  return {
    coordinates: { pin: stood.pin, docUrl: doc.url, port }, sawReply, seated: () => gateSync.wss.clients.size,
    close: async () => {
      await repo.shutdown().catch(() => { /* already down */ });
      server.close(); registry.close(); gateSync.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

/** What a role's crossing came to. `ok` says the gate did the right thing for the role. */
export interface CrossVerdict {
  readonly role: CrossRole;
  readonly outcome: "synced" | "denied";
  readonly ok: boolean;
  readonly detail: string;
}

/** The face a role wears, and the audience it binds. */
async function roleFace(role: CrossRole): Promise<{ face: CrossingFace; audience: string }> {
  const face = role === "impostor" ? await forgedFace(CROSSING_NEXUS, "crossing leaf", "crossing forger") : await crossingFace(CROSSING_NEXUS, "crossing leaf");
  return { face, audience: role === "wrong-bind" ? WRONG_AUDIENCE : CROSSING_AUDIENCE };
}

/**
 * Cross as `role` against the daemon at `host:port`: dial with a face presentation, then wait for the seeded doc. The
 * window is a bound the caller names; a denial is the doc never arriving inside it.
 */
export async function crossRole(role: CrossRole, at: { host: string; coordinates: CrossingCoordinates }, opts: {
  greet: string; windowMs?: number; log?: (line: string) => void;
}): Promise<CrossVerdict> {
  const log = opts.log ?? (() => { /* quiet */ });
  const { face, audience } = await roleFace(role);
  const { pin, port, docUrl } = at.coordinates;
  const pins = hearthPinIndex();
  pins.put("hearth-crossing", pin);
  let anergy = "";
  const adapter = new LarWSClientAdapter({
    url: `ws://${at.host}:${String(port)}${pin.route}`, pins, hearth: "hearth-crossing", nexus: pin.nexus, audience,
    deadlines: { draw(lapse) { const t = setTimeout(lapse, 4_000); return { cancel: () => clearTimeout(t) }; } },
    presentation: { certificate: face.certificate, signer: face.signer, arm: face.arm, history: face.history },
    retryInterval: 250, onAnergy: (reason) => { anergy = reason; },
  });
  const repo = new Repo({ network: [adapter], sharePolicy: async () => true });
  log(`[crossing-client] (${role}) CROSSING → ${at.host}:${String(port)} (aud=${audience === CROSSING_AUDIENCE ? "daemon" : "personal(wrong)"})`);
  // `find` never settles for a doc no peer holds: a denied crossing is the doc not arriving inside the window.
  const windowMs = opts.windowMs ?? 8_000;
  let handle: DocHandle<GreetDoc> | null = null;
  const outcome = await Promise.race([
    repo.find<GreetDoc>(docUrl as AutomergeUrl).then((h) => {
      handle = h;
      return new Promise<"synced">((resolve) => {
        const check = (): void => { if (h.doc()?.tiddlers?.[GREETING_KEY]) resolve("synced"); };
        h.on("change", check); check();
      });
    }, () => new Promise<"denied">(() => { /* a failed find settles at the window */ })),
    new Promise<"denied">((resolve) => setTimeout(() => resolve("denied"), windowMs)),
  ]);

  let verdict: CrossVerdict;
  if (role === "admitted") {
    const h = handle as DocHandle<GreetDoc> | null;
    const got = outcome === "synced" ? h?.doc()?.tiddlers?.[GREETING_KEY]?.text : undefined;
    if (outcome !== "synced") verdict = { role, outcome, ok: false, detail: "expected to CROSS but was denied" };
    else if (got !== opts.greet) verdict = { role, outcome, ok: false, detail: `content mismatch: "${String(got)}"` };
    else {
      h!.change((d) => { d.tiddlers[REPLY_KEY] = { text: "a citizen answers" }; });
      await new Promise((r) => setTimeout(r, 1_500));
      verdict = { role, outcome, ok: true, detail: `crossed + read the mesh: "${got}"` };
    }
  } else {
    verdict = outcome === "synced"
      ? { role, outcome, ok: false, detail: "SECURITY FAILURE — the gate admitted a leaf it must refuse" }
      : { role, outcome, ok: true, detail: `correctly DENIED at the gate${anergy ? ` (${anergy})` : ""}` };
  }
  try { adapter.disconnect(); } catch { /* not connected */ }
  await repo.shutdown().catch(() => { /* already down */ });
  return verdict;
}
