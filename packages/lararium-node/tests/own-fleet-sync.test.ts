/**
 * own-fleet-sync — the no-break-own-sync witness: one face's two devices sync the face's document
 * through the real gate, and nobody else's device reads it.
 *
 * The hearth stands as a vessel composes it: one gate from `vesselGate` (the held-root admit reader, the real
 * sorter, the grant ring over the face's record and the root it holds, the shadow ring over the D4 device book),
 * served by `faceGateServer` on a live socket, each seated session handed to Automerge through `gateSyncServer`,
 * and every document decided by the self-slot share verdict with D3's face view (`face-fleet-view`). The device
 * book reads the issued book the fleet-join answer noted under sealed custody (`noteIssuedFaceKeys`).
 *
 * The hearth WEARS the founder's face and also carries a second face, B, with its own plane. Its personal-wiki doc
 * is tagged by no face: the worn face's books (the bridge until O1, `face-fleet-view`).
 *
 * Proven, each with its control:
 *   · THE JOINEE, a second device of the founder's face, dials with its own certificate and the face's admit, sorts
 *     same-operator, and syncs the face's plane AND the personal-wiki doc both ways / RED (D3): it never reads face
 *     B's plane;
 *   · RED: a device of face B, same-operator for B, reads B's plane and never the worn face's wiki or plane;
 *   · RED: a third presenter, contracted under its own admit, reads the shelf document / and never the face's plane;
 *   · RED: the joinee's device set aside from the fleet sorts contracted and never reads the plane / CONTROL: raised
 *     again, it reads it;
 *   · RED: a joinee the issued book never noted reads fleet-aside, sorts contracted and never reads the plane.
 */
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Repo, generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { WebSocket as WsSocket } from "ws";
import {
  DAEMON_BAG_ID, PERSONA_GROUP_ID_TIDDLER, personaBagIdFor, personaMembershipEntries, personaSiblingBagIds, shareConfigOf,
  type FederationGate, type GateSession,
} from "@lararium/mesh";
import { LarWSClientAdapter } from "../../lararium-mesh/src/lar-ws-client-adapter.js";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { AUDIENCE, GROUP, presenter, sibling, world, type Presenter, type World } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { faceGateServer, gateSessionRegistry } from "../src/face-gate-server.js";
import { gateSyncServer } from "../src/gate-sync-server.js";
import { vesselGate } from "../src/vessel-gates.js";
import { gateShadowRing } from "../src/gate-shadow-ring.js";
import { gateGrantRing } from "../src/gate-rings.js";
import { faceDeviceBook } from "../src/face-device-book.js";
import { faceFleetViews } from "../src/face-fleet-view.js";
import { noteIssuedFaceKeys, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const FOUNDER_DEVICE = "f0".repeat(32);
const JOINEE_DEVICE = "10".repeat(32);
const ROOT_KEY = "ee".repeat(32);
const GROUP_B = "c3d4e5f6a7b80912";
const B_DEVICE = "30".repeat(32);

const realDeadlines = () => ({ draw(lapse: () => void) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } });
const turn = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

interface Hearth {
  readonly w: World;
  readonly base: string;
  readonly plane: AutomergeUrl;
  readonly shelf: AutomergeUrl;
  /** The worn face's personal-wiki doc: a slot doc no face tags, the vessel's own book. */
  readonly wiki: AutomergeUrl;
  /** Face B's plane: another face's book on the same hearth. */
  readonly planeB: AutomergeUrl;
  /** Face B's own presenter, admitted at the Nexus, its first vessel noted to `B_DEVICE`. */
  readonly faceB: Presenter;
  readonly asideDevices: Set<string>;
  readonly sessions: Map<string, GateSession>;
  readonly repo: Repo;
  close(): Promise<void>;
}

const opened: Array<{ close(): Promise<void> | void }> = [];
let custody: SeatedScratchCustody | null = null;
afterEach(async () => {
  for (const o of opened.splice(0).reverse()) await o.close();
  await custody?.drop();
  custody = null;
});

/** The hearth: the founder's face, the joinee noted in its issued book (when `noted`), one sync gate on a live socket. */
async function standHearth(founder: { w: World; p: Presenter }, joinee: Presenter, opts: { noted?: boolean } = {}): Promise<Hearth> {
  const { w, p } = founder;
  custody = await seatScratchCustody("own-fleet-sync");
  if (opts.noted !== false) {
    await noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: ROOT_KEY, device: JOINEE_DEVICE, certificates: [joinee.certificate] });
  }
  const faceB = await presenter(w, "face B");
  await noteIssuedFaceKeys({ personaGroup: GROUP_B, rootKey: ROOT_KEY, device: B_DEVICE, certificates: [faceB.certificate] });
  const asideDevices = new Set<string>();
  const book = faceDeviceBook({
    records: async () => (await Promise.all([GROUP, GROUP_B].map((g) => readFaceJoinRecord(g)))).filter((r) => r !== null),
    ownVesselKey: async () => FOUNDER_DEVICE,
  });
  await book.refresh();

  // The face's documents on the hearth: its plane, its three travelling planes, and the daemon doc.
  const repo = new Repo({ shareConfig: shareConfigOf(async (peerId, documentId) => policy(peerId, documentId)) } as never);
  const planeHandle = repo.create({ fleet: "the face's own document" });
  const shelfHandle = repo.create({ shelf: "the public shelf" });
  const wiki = repo.create({ wiki: "the founder's personal wiki" });
  const planeB = repo.create({ fleet: "face B's own document" });
  const sib = personaSiblingBagIds(personaBagIdFor(GROUP));
  const bootstrap: Record<string, { text?: string }> = {
    [DAEMON_BAG_ID]: { text: generateAutomergeUrl() }, [PERSONA_GROUP_ID_TIDDLER]: { text: GROUP },
    [sib.identities]: { text: generateAutomergeUrl() }, [sib.circles]: { text: generateAutomergeUrl() }, [sib.sessions]: { text: generateAutomergeUrl() },
  };
  for (const e of personaMembershipEntries({ personaGroupId: GROUP, url: planeHandle.url })) bootstrap[e.title] = { text: e.text ?? undefined };
  for (const e of personaMembershipEntries({ personaGroupId: GROUP_B, url: planeB.url })) bootstrap[e.title] = { text: e.text ?? undefined };
  const views = faceFleetViews(() => bootstrap, undefined, () => new Set([String(interpretAsDocumentId(wiki.url))]));   // the catalog names the wiki as a book
  const shelfId = interpretAsDocumentId(shelfHandle.url);
  const shelfGate: FederationGate = { mayFederate: (d) => d === shelfId };

  const gateSync = gateSyncServer();
  const registry = gateSessionRegistry((channel, session) => gateSync.onOpen(channel, session));
  const server = faceGateServer();
  const adapter = new NodeWSServerAdapter(gateSync.wss as never, 60_000);
  const sessions = new Map<string, GateSession>();
  adapter.on("peer-candidate", ({ peerId }) => {
    // The adapter keys the socket after it emits, as the vessel's own seat reads it: one microtask on.
    queueMicrotask(() => {
      const session = gateSync.sessionOf((adapter.sockets as Record<string, unknown>)[peerId]);
      if (!session) return;
      sessions.set(peerId, session);
      views.seat(peerId, session.class === "same-operator" ? session.face : null);
    });
  });
  adapter.on("peer-disconnected", ({ peerId }) => { sessions.delete(peerId); views.drop(peerId); });
  repo.networkSubsystem.addNetworkAdapter(adapter);
  async function policy(peerId: PeerId, documentId?: DocumentId): Promise<boolean> {
    await new Promise<void>((r) => queueMicrotask(r));
    const session = sessions.get(peerId);
    if (!session) return false;
    return selfSlotShareDecision({
      hasWsSocket: true, peerClass: session.class, selfSlotFedGate: shelfGate, antigenRing: null, membership: null, planeSeal: null,
      federationPosture: "private", peerId, documentId, sessionFace: views.gateFor(peerId),
    });
  }

  const reading = { ...w.held!, aid: w.nexus, via: "consent", island: `island-${w.nexus}`, sealLineage: [], posture: "private" } as CarriedNexusReading;
  const gate = vesselGate({
    readings: async () => [reading],
    posture: () => "private",
    shadows: gateShadowRing({ ring: { fold: () => ({ fleets: [], realms: [] }), deviceAside: (d) => asideDevices.has(d) }, deviceOf: (x) => book.deviceOf(x) }),
    grants: gateGrantRing({ joinRecords: async () => [], rootHoldings: () => [
      { personaGroup: GROUP, rootKey: ROOT_KEY, scopes: [p.scope] },
      { personaGroup: GROUP_B, rootKey: ROOT_KEY, scopes: [faceB.scope] },
    ] }),
    withdrawals: w.withdrawals, deadlines: realDeadlines(), audience: AUDIENCE,
  }, { bundle: w.bundle, nexus: w.nexus, sessions: registry.table });
  server.stand({ gate, pin: w.pin });
  const http: Server = createServer();
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (http.address() as { port: number }).port;
  const hearth: Hearth = {
    w, base: `ws://127.0.0.1:${port}/ws`, plane: planeHandle.url, shelf: shelfHandle.url, wiki: wiki.url, planeB: planeB.url, faceB, asideDevices, sessions, repo,
    async close() {
      server.close(); registry.close(); gateSync.close(); views.close();
      await repo.shutdown().catch(() => undefined);
      await new Promise<void>((r) => http.close(() => r()));
    },
  };
  opened.push(hearth);
  return hearth;
}

/** A device that dials the hearth's gate wearing `who`, with its own Repo behind it. */
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

/** What `repo` reads of `url` within a bound: the document, or null where every peer answered it unavailable. */
async function reads(repo: Repo, url: AutomergeUrl): Promise<Record<string, unknown> | null> {
  try {
    const handle = await Promise.race([repo.find<Record<string, unknown>>(url), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 8_000))]);
    return { ...(handle.doc() ?? {}) };
  } catch { return null; }
}

async function classOf(h: Hearth, peerId: string): Promise<string | undefined> {
  for (let i = 0; i < 200 && !h.sessions.has(peerId); i++) await turn();
  return h.sessions.get(peerId)?.class;
}

async function faceAndJoinee() {
  const w = await world();
  const p = await presenter(w, "the founder's face");
  const joinee = await sibling(p, "the joinee device");
  return { w, p, joinee };
}

describe("one face's two devices sync through the real gate", () => {
  test("the joinee sorts same-operator and syncs the face's plane both ways; RED: a contracted third reads the shelf alone", async () => {
    const { w, p, joinee } = await faceAndJoinee();
    const h = await standHearth({ w, p }, joinee);
    const laptop = await device(h, joinee, "joinee-device");
    const got = await reads(laptop, h.plane);
    expect(await classOf(h, "joinee-device")).toBe("same-operator");
    expect(got?.["fleet"]).toBe("the face's own document");
    // Both ways: the joinee's change reaches the hearth.
    (await laptop.find<Record<string, unknown>>(h.plane)).change((d) => { d["fromJoinee"] = true; });
    const back = await h.repo.find<Record<string, unknown>>(h.plane);
    for (let i = 0; i < 200 && back.doc()?.["fromJoinee"] !== true; i++) await turn();
    expect(back.doc()?.["fromJoinee"]).toBe(true);
    // The worn face's personal wiki crosses both ways too.
    expect((await reads(laptop, h.wiki))?.["wiki"]).toBe("the founder's personal wiki");
    (await laptop.find<Record<string, unknown>>(h.wiki)).change((d) => { d["fromJoinee"] = true; });
    const wikiBack = await h.repo.find<Record<string, unknown>>(h.wiki);
    for (let i = 0; i < 200 && wikiBack.doc()?.["fromJoinee"] !== true; i++) await turn();
    expect(wikiBack.doc()?.["fromJoinee"]).toBe(true);
    // RED (D3): the same-operator class reads no other face's book: face B's plane stays home.
    expect(await reads(laptop, h.planeB)).toBeNull();

    // RED: another face, admitted at the Nexus under its own admit, sorts contracted.
    const stranger = await presenter(w, "another human's face");
    const other = await device(h, stranger, "contracted-device");
    expect((await reads(other, h.shelf))?.["shelf"]).toBe("the public shelf");      // CONTROL: its session carries
    expect(await classOf(h, "contracted-device")).toBe("contracted");
    expect(await reads(other, h.plane)).toBeNull();                                  // RED: the face's plane stays home
    expect(await reads(other, h.wiki)).toBeNull();                                   // RED: and so does its wiki
  });

  test("RED: a device of face B reads B's plane and never the worn face's wiki or plane", async () => {
    const { w, p, joinee } = await faceAndJoinee();
    const h = await standHearth({ w, p }, joinee);
    const bDevice = await device(h, h.faceB, "face-b-device");
    expect((await reads(bDevice, h.planeB))?.["fleet"]).toBe("face B's own document");   // CONTROL: its own book
    expect(await classOf(h, "face-b-device")).toBe("same-operator");
    expect(await reads(bDevice, h.wiki)).toBeNull();
    expect(await reads(bDevice, h.plane)).toBeNull();
  });

  test("RED: the joinee's device set aside sorts contracted and reads no plane; CONTROL: raised, it reads it", async () => {
    const { w, p, joinee } = await faceAndJoinee();
    const h = await standHearth({ w, p }, joinee);
    h.asideDevices.add(JOINEE_DEVICE);
    const cut = await device(h, joinee, "cut-device");
    expect((await reads(cut, h.shelf))?.["shelf"]).toBe("the public shelf");
    expect(await classOf(h, "cut-device")).toBe("contracted");
    expect(await reads(cut, h.plane)).toBeNull();
    h.asideDevices.delete(JOINEE_DEVICE);
    const raised = await device(h, joinee, "raised-device");
    expect((await reads(raised, h.plane))?.["fleet"]).toBe("the face's own document");
    expect(await classOf(h, "raised-device")).toBe("same-operator");
  });

  test("RED: a joinee the issued book never noted reads fleet-aside, sorts contracted and reads no plane", async () => {
    const { w, p, joinee } = await faceAndJoinee();
    const h = await standHearth({ w, p }, joinee, { noted: false });
    const unnoted = await device(h, joinee, "unnoted-device");
    expect((await reads(unnoted, h.shelf))?.["shelf"]).toBe("the public shelf");
    expect(await classOf(h, "unnoted-device")).toBe("contracted");
    expect(await reads(unnoted, h.plane)).toBeNull();
  });
});
