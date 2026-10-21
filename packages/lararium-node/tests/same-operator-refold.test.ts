/**
 * same-operator-refold — a same-operator session ANSWERS TO THE REFOLD: a device set aside after its seat, or an admit
 * revoked after its seat, ends the session it stood (house ruling "A device set aside"; kapae#/reach).
 *
 * The hearth stands as `own-fleet-sync` stands it: one gate from `vesselGate` over the real sorter, the grant ring, the
 * shadow ring over the D4 device book, served by `faceGateServer` on a live socket, each seated session handed to
 * Automerge through `gateSyncServer`, every document decided by the self-slot share verdict with D3's face view. The
 * share verdict's shadow consult reads the peer's DEVICE (`seatedDeviceKey`) exactly as the vessel's edge ring reads it
 * (`vesselKeyOfPeer`), and the refold re-reads each same-operator seat (`sameOperatorStands`) and drops the ones that no
 * longer stand, as the vessel's refold does.
 *
 * Proven, each with its control:
 *   · RED: the joinee's device set aside AFTER its seat draws Mu on its next ask, and the refold closes its session
 *     / CONTROL: before the shadow, and for a refold that reads nothing new, the session stands and reads the plane;
 *   · RED: the face's admit revoked AFTER the seat closes the session at the next refold / CONTROL: the same refold
 *     before the revoke keeps it;
 *   · the device the share verdict reads is the device edge the face-scoped key was certified to, never the face key.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Repo, generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { WebSocket as WsSocket } from "ws";
import {
  DAEMON_BAG_ID, PERSONA_GROUP_ID_TIDDLER, carriageEntryActCid, personaBagIdFor, personaMembershipEntries, personaSiblingBagIds, shareConfigOf,
  type FederationGate, type GateSession, type ShadowConsult,
} from "@lararium/mesh";
import { LarWSClientAdapter } from "../../lararium-mesh/src/lar-ws-client-adapter.js";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { AUDIENCE, GROUP, presenter, sibling, world, type Presenter, type World } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { faceGateServer, gateSessionRegistry } from "../src/face-gate-server.js";
import { gateSyncServer } from "../src/gate-sync-server.js";
import { vesselAdmitReader, vesselGate, type VesselGateDeps } from "../src/vessel-gates.js";
import { gateShadowRing } from "../src/gate-shadow-ring.js";
import { gateGrantRing } from "../src/gate-rings.js";
import { faceDeviceBook } from "../src/face-device-book.js";
import { faceFleetViews } from "../src/face-fleet-view.js";
import { noteIssuedFaceKeys, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";
import { sameOperatorStands, seatedDeviceKey } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const FOUNDER_DEVICE = "f0".repeat(32);
const JOINEE_DEVICE = "10".repeat(32);
const ROOT_KEY = "ee".repeat(32);

const realDeadlines = () => ({ draw(lapse: () => void) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } });
const turn = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

interface Hearth {
  readonly w: World;
  readonly base: string;
  readonly plane: AutomergeUrl;
  readonly asideDevices: Set<string>;
  readonly sessions: Map<string, GateSession>;
  /** The share verdict, asked directly: what the hearth answers `peerId` for `url` now. */
  asks(peerId: string, url: AutomergeUrl): Promise<boolean>;
  /** The refold's same-operator sweep: drops each same-operator session that no longer stands; answers how many. */
  refold(): Promise<number>;
  live(): readonly GateSession[];
}

const opened: Array<{ close(): Promise<void> | void }> = [];
let custody: SeatedScratchCustody | null = null;
afterEach(async () => {
  for (const o of opened.splice(0).reverse()) await o.close();
  await custody?.drop();
  custody = null;
});

async function standHearth(founder: { w: World; p: Presenter }, joinee: Presenter): Promise<Hearth> {
  const { w, p } = founder;
  custody = await seatScratchCustody("same-operator-refold");
  await noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT_KEY, device: JOINEE_DEVICE, certificates: [joinee.certificate] });
  const asideDevices = new Set<string>();
  const book = faceDeviceBook({
    records: async () => { const r = await readFaceJoinRecord(GROUP); return r ? [r] : []; },
    ownVesselKey: async () => FOUNDER_DEVICE,
  });
  await book.refresh();

  const repo = new Repo({ shareConfig: shareConfigOf(async (peerId, documentId) => policy(peerId, documentId)) } as never);
  const planeHandle = repo.create({ fleet: "the face's own document" });
  const shelfHandle = repo.create({ shelf: "the public shelf" });
  const sib = personaSiblingBagIds(personaBagIdFor(GROUP));
  const bootstrap: Record<string, { text?: string }> = {
    [DAEMON_BAG_ID]: { text: generateAutomergeUrl() }, [PERSONA_GROUP_ID_TIDDLER]: { text: GROUP },
    [sib.identities]: { text: generateAutomergeUrl() }, [sib.circles]: { text: generateAutomergeUrl() }, [sib.sessions]: { text: generateAutomergeUrl() },
  };
  for (const e of personaMembershipEntries({ personaGroupId: GROUP, url: planeHandle.url })) bootstrap[e.title] = { text: e.text ?? undefined };
  const views = faceFleetViews(() => bootstrap);
  const shelfId = interpretAsDocumentId(shelfHandle.url);
  const shelfGate: FederationGate = { mayFederate: (d) => d === shelfId };

  const gateSync = gateSyncServer();
  const registry = gateSessionRegistry((channel, session) => gateSync.onOpen(channel, session));
  const server = faceGateServer();
  const adapter = new NodeWSServerAdapter(gateSync.wss as never, 60_000);
  const sessions = new Map<string, GateSession>();
  adapter.on("peer-candidate", ({ peerId }) => {
    queueMicrotask(() => {
      const session = gateSync.sessionOf((adapter.sockets as Record<string, unknown>)[peerId]);
      if (!session) return;
      sessions.set(peerId, session);
      views.seat(peerId, session.class === "same-operator" ? session.face : null);
    });
  });
  adapter.on("peer-disconnected", ({ peerId }) => { sessions.delete(peerId); views.drop(peerId); });
  repo.networkSubsystem.addNetworkAdapter(adapter);
  // THE EDGE RING'S CONSULT, as the vessel composes it: the device behind the peer, then the fleet shadow over it.
  const shadow: ShadowConsult = {
    aside: (peerId) => {
      const device = seatedDeviceKey(sessions.get(peerId), (x) => book.deviceOfSeat(x));
      return device === null ? false : asideDevices.has(device);
    },
  };
  async function policy(peerId: PeerId | string, documentId?: DocumentId): Promise<boolean> {
    await new Promise<void>((r) => queueMicrotask(r));
    const session = sessions.get(peerId);
    if (!session) return false;
    return selfSlotShareDecision({
      hasWsSocket: true, peerClass: session.class, selfSlotFedGate: shelfGate, antigenRing: null, membership: null, planeSeal: null,
      federationPosture: "private", peerId, documentId, sessionFace: views.gateFor(peerId), shadow,
    });
  }

  // The held root reads fresh at every ask, so a revoke a suite lands on `w.held` reaches the next read.
  const deps: VesselGateDeps = {
    readings: async () => [{ ...w.held!, aid: w.nexus, via: "consent", island: `island-${w.nexus}`, sealLineage: [], posture: "private" } as CarriedNexusReading],
    posture: () => "private",
    shadows: gateShadowRing({ ring: { fold: () => ({ fleets: [], realms: [] }), deviceAside: (d) => asideDevices.has(d) }, deviceOf: (x) => book.deviceOf(x) }),
    grants: gateGrantRing({ joinRecords: async () => [], rootHoldings: () => [{ personaGroup: GROUP, rootKey: ROOT_KEY, scopes: [p.scope] }] }),
    withdrawals: w.withdrawals, deadlines: realDeadlines(), audience: AUDIENCE,
  };
  server.stand({ gate: vesselGate(deps, { bundle: w.bundle, nexus: w.nexus, sessions: registry.table }), pin: w.pin });
  const http: Server = createServer();
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (http.address() as { port: number }).port;
  opened.push({
    async close() {
      server.close(); registry.close(); gateSync.close(); views.close();
      await repo.shutdown().catch(() => undefined);
      await new Promise<void>((r) => http.close(() => r()));
    },
  });
  return {
    w, base: `ws://127.0.0.1:${port}/ws`, plane: planeHandle.url, asideDevices, sessions,
    asks: (peerId, url) => policy(peerId, interpretAsDocumentId(url)),
    async refold() {
      const gone = new Set<GateSession>();
      for (const { session } of registry.live()) {
        if (session.class !== "same-operator") continue;
        if (!(await sameOperatorStands(session, { deviceOf: (x) => book.deviceOfSeat(x), deviceAside: (d) => asideDevices.has(d), admits: (nexus) => vesselAdmitReader(deps, nexus) }))) gone.add(session);
      }
      return registry.drop((s) => gone.has(s));
    },
    live: () => registry.live().map((s) => s.session),
  };
}

async function device(h: Hearth, who: Presenter, peerId: string): Promise<Repo> {
  const client = new LarWSClientAdapter({
    url: h.base, pins: { get: () => h.w.pin }, hearth: "hearth-one", nexus: h.w.nexus,
    presentation: { certificate: who.certificate, signer: who.signer, arm: who.arm, history: who.history },
    audience: AUDIENCE, deadlines: realDeadlines(),
    dialSocket: () => wsDialSocket(h.base, (u, protocols) => new WsSocket(u, protocols, { perMessageDeflate: false }) as unknown as WsLike),
    retryInterval: 60_000,
  });
  const repo = new Repo({ network: [client], peerId: peerId as PeerId, sharePolicy: async () => true });
  opened.push({ close: () => repo.shutdown().catch(() => undefined) });
  return repo;
}

async function reads(repo: Repo, url: AutomergeUrl): Promise<Record<string, unknown> | null> {
  try {
    const handle = await Promise.race([repo.find<Record<string, unknown>>(url), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 8_000))]);
    return { ...(handle.doc() ?? {}) };
  } catch { return null; }
}

async function seated(h: Hearth, peerId: string): Promise<GateSession> {
  for (let i = 0; i < 200 && !h.sessions.has(peerId); i++) await turn();
  const session = h.sessions.get(peerId);
  if (!session) throw new Error(`no session seated for ${peerId}`);
  return session;
}

async function gone(h: Hearth, peerId: string): Promise<boolean> {
  for (let i = 0; i < 200 && h.sessions.has(peerId); i++) await turn();
  return !h.sessions.has(peerId);
}

async function faceAndJoinee() {
  const w = await world();
  const p = await presenter(w, "the founder's face");
  const joinee = await sibling(p, "the joinee device");
  return { w, p, joinee };
}

describe("a same-operator session answers to the refold", () => {
  test("RED: the joinee's device set aside AFTER its seat draws Mu on its next ask and the refold closes it; CONTROL: before, it stands", async () => {
    const { w, p, joinee } = await faceAndJoinee();
    const h = await standHearth({ w, p }, joinee);
    const laptop = await device(h, joinee, "joinee-device");
    expect((await reads(laptop, h.plane))?.["fleet"]).toBe("the face's own document");
    const session = await seated(h, "joinee-device");
    expect(session.class).toBe("same-operator");
    // CONTROL: a refold that reads nothing new keeps the session, and its next ask reads the plane.
    expect(await h.refold()).toBe(0);
    expect(await h.asks("joinee-device", h.plane)).toBe(true);

    h.asideDevices.add(JOINEE_DEVICE);
    // RED: the very next ask draws Mu, the gate not yet re-sorting it.
    expect(await h.asks("joinee-device", h.plane)).toBe(false);
    // RED: the refold closes the session.
    expect(await h.refold()).toBe(1);
    expect(h.live()).not.toContain(session);
    expect(await gone(h, "joinee-device")).toBe(true);
    // The device the verdict read is the device edge the face-scoped key was certified to, never the face key.
    expect(seatedDeviceKey(session, () => ({ device: JOINEE_DEVICE }))).toBe(JOINEE_DEVICE);
  });

  test("RED: the face's admit revoked AFTER the seat closes the session at the next refold; CONTROL: before the revoke it stands", async () => {
    const { w, p, joinee } = await faceAndJoinee();
    const h = await standHearth({ w, p }, joinee);
    const laptop = await device(h, joinee, "joinee-device");
    expect((await reads(laptop, h.plane))?.["fleet"]).toBe("the face's own document");
    const session = await seated(h, "joinee-device");
    expect(session.class).toBe("same-operator");
    expect(await h.refold()).toBe(0);                                                    // CONTROL

    const revoke = await w.revokeFor(p.chain.face, [carriageEntryActCid(p.admit)]);
    w.held = { ...w.held!, denyBoard: [revoke] };
    expect(await h.refold()).toBe(1);                                                    // RED
    expect(h.live()).not.toContain(session);
    expect(await gone(h, "joinee-device")).toBe(true);
  });
});

describe("the persona ring's face-grant seat reads the shadow through the device book", () => {
  const CODE = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
  test("RED: a face-grant seat whose face key is certified to an aside device reads aside; the grant proof stays the face key", () => {
    // A face-join grant names the joinee's FACE key (persona-ring-cross-operator-admit), so the proof stays the face key.
    expect(CODE).toMatch(/provenKeyOf:\s*\(peerId\)\s*=>\s*peerIdentifierMap\.get\(peerId\)\s*\?\?\s*null,/);
    // The shadow resolves that face key to every device a gate-seated session under it was certified to (D4).
    expect(CODE).toMatch(/deviceAside:\s*\(key\)\s*=>\s*edgeShadows\s*\?\s*edgeShadows\.widenBlocked\(deviceEdge\.personaRootDid\)\s*\|\|\s*edgeShadows\.deviceAside\(key\)\s*\|\|\s*seatedDevicesOfFace\(key\)\.some\(/); // RED
    expect(CODE).toMatch(/const seatedDevicesOfFace = \(key: string\): string\[\] =>/);
  });
});
